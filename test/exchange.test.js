import test from 'node:test';
import assert from 'node:assert/strict';
import {
    centeredLogValuations, inheritedValuations, combineEffective, negotiateSwap,
} from '../src/core/exchange.js';
import {Simulation} from '../src/core/simulation.js';
import {LINK_FORMATION} from '../src/mechanics/linkFormation.js';
import {EVENTS} from '../src/core/events.js';

const close = (a, b, eps = 1e-12) => Math.abs(a - b) <= eps;

// ---- pure pieces -------------------------------------------------------------------------

test('centred log valuations are scale-free', () => {
    const a = centeredLogValuations([1, 2, 4], 3, new Float64Array(3));
    const b = centeredLogValuations([10, 20, 40], 3, new Float64Array(3));
    for (let r = 0; r < 3; r++) assert.ok(close(a[r], b[r]));
    assert.ok(close(a[0] + a[1] + a[2], 0), 'centred on zero');
    assert.ok(close(a[2] - a[1], Math.log(2)));
});

test('inherited valuation is the best neighbour offer less the markup, and -Infinity alone', () => {
    const out = new Float64Array(3);
    inheritedValuations([], 0.2, out);
    assert.deepEqual([...out], [-Infinity, -Infinity, -Infinity]);
    inheritedValuations([Float64Array.of(1, -1, 0), Float64Array.of(0.5, 0.3, -2)], 0.2, out);
    assert.ok(close(out[0], 0.8) && close(out[1], 0.1) && close(out[2], -0.2));
    const eff = combineEffective(Float64Array.of(0.9, 0, -1), out, new Float64Array(3));
    assert.ok(close(eff[0], 0.9) && close(eff[1], 0.1) && close(eff[2], -0.2));
});

test('negotiateSwap: higher rate buys, price is the geometric midpoint, both sides gain', () => {
    assert.equal(negotiateSwap(0.5, 0.48, 0.05, 1), null, 'gap within threshold');
    const deal = negotiateSwap(1.0, 0.2, 0.05, 2);
    assert.equal(deal.buyerIsA, true);
    assert.ok(close(deal.logPrice, 0.6));
    assert.ok(close(deal.amountS / deal.amountR, Math.exp(0.6)), 'amounts respect the price');
    assert.ok(close(deal.amountR * deal.amountS, 4), 'geometric mean of the quantities is the cap');
    // The buyer values one r at e^1.0 s and pays e^0.6; the seller parts with e^0.2 worth for e^0.6.
    assert.ok(deal.logPrice < 1.0 && deal.logPrice > 0.2);
    const mirrored = negotiateSwap(0.2, 1.0, 0.05, 2);
    assert.equal(mirrored.buyerIsA, false);
    assert.ok(close(mirrored.logPrice, deal.logPrice));
});

// ---- behaviour in a running simulation ---------------------------------------------------

const small = {seed: 21, initialHumans: 150, forestwidth: 500, forestheight: 300, production_labor_threshold: 0};

test('pairwise exchange conserves resources under every link formation and several worlds', () => {
    const worlds = [
        {params: small},
        {params: {...small, numResources: 4, numVillages: 2}, mechanics: {population: 'villages', metabolism: 'dietBalance'}, terrain: 'regionalGroups'},
        {params: {...small, wrapped: true, tradeAmountPerInvocation: 3}, mechanics: {valuation: 'linearNeedOverHoldings'}},
    ];
    for (const variant of Object.keys(LINK_FORMATION)) {
        for (const w of worlds) {
            const sim = new Simulation({...w, mechanics: {...w.mechanics, exchange: 'pairwise', linkFormation: variant}}).run(250);
            assert.ok(sim.world.exchange.totalSwaps > 0, `${variant}: no swaps at all`);
            for (const check of sim.checkConservation(1e-6)) {
                assert.ok(check.ok, `${variant}: resource ${check.resource} drifted by ${check.drift}`);
            }
        }
    }
});

test('pairwise exchange is deterministic, and the network is part of the state hash', () => {
    const cfg = {params: small, mechanics: {exchange: 'pairwise', linkFormation: 'usageRewiring'}};
    const a = new Simulation(cfg).run(150);
    const b = new Simulation(cfg).run(150);
    assert.equal(a.hashState(), b.hashState());

    const net = b.world.exchange.network;
    net.unlinkEdge(net.edgeList()[0]);
    assert.notEqual(a.hashState(), b.hashState(), 'dropping one edge must change the hash');
});

test('pairwise exchange creates no trade objects; posted trades create no network', () => {
    const pw = new Simulation({params: small, mechanics: {exchange: 'pairwise'}}).run(150);
    assert.equal(pw.world.trademanager.trades.length, 0);
    assert.equal(pw.world.trademanager.total_trades_made, 0);

    const posted = new Simulation({params: small}).run(150);
    assert.equal(posted.world.exchange.network, undefined);
    assert.ok(posted.world.humans.every(h => h.exchange === undefined));
});

test('swap sizing stops at the tangency: no swap leaves the pair wanting to trade straight back', () => {
    const sim = new Simulation({params: {...small, tradeAmountPerInvocation: 5},
        mechanics: {exchange: 'pairwise', linkFormation: 'localProbability'}});
    const ex = sim.world.exchange;
    let checked = 0;
    // Sizing bisects on the gap and keeps the side where the buyer still wants more, and the
    // real transfer repeats the hypothetical's arithmetic exactly, so the gap never flips.
    sim.events.on(EVENTS.EXCHANGE_SWAP, ({buyer, seller, resourceBought: r, resourcePaid: s}) => {
        const mBuyer = buyer.exchange.effective[r] - buyer.exchange.effective[s];
        const mSeller = seller.exchange.effective[r] - seller.exchange.effective[s];
        assert.ok(mBuyer - mSeller >= 0,
            `after the swap the seller values r over s more than the buyer (gap ${mBuyer - mSeller})`);
        checked++;
    });
    for (let t = 0; t < 120; t++) sim.step();
    assert.ok(checked > 100, `too few swaps checked: ${checked}`);
    assert.ok(ex.totalSwaps > 0);
});

/**
 * The model's central claim for this mechanic: a middleman needs no special rule. i sits
 * between a Y-rich producer j and a Y-starved consumer k, who cannot see each other. i's
 * effective valuation of Y is inherited from k, so i buys from j for exactly the reason it
 * would buy to eat, then resells to k.
 */
test('a pure middleman emerges: Y flows j -> i -> k across two links', () => {
    const sim = new Simulation({params: {seed: 1, initialHumans: 3, numResources: 3},
        mechanics: {exchange: 'pairwise', linkFormation: 'localProbability'}});
    const ex = sim.world.exchange;
    const net = ex.network;
    const [j, i, k] = sim.world.humans;
    for (const edge of net.edgeList()) net.unlinkEdge(edge);
    net.link(j, i, 0);
    net.link(i, k, 0);

    const full = j.maxEnergyPerResource;
    j.metabolism = [full * 0.95, full * 0.3, full * 0.3]; j.supply = [40, 1, 1];
    i.metabolism = [full * 0.9, full * 0.9, full * 0.9];  i.supply = [5, 5, 5];
    k.metabolism = [full * 0.1, full * 0.95, full * 0.95]; k.supply = [0, 40, 40];

    // Exchange only: no production or metabolism to muddy the flows.
    for (let t = 0; t < 30; t++) { sim.tick++; ex.update(); }

    const Y = 0;
    assert.equal(net.edgeBetween(j, k), null, 'j and k never meet');
    assert.ok(k.supply[Y] > 5, `k should have received Y, holds ${k.supply[Y]}`);
    assert.ok(j.supply[Y] < 35, `j should have sold Y, holds ${j.supply[Y]}`);
    assert.ok(i.exchange.passThrough(Y) > 0.8 * k.supply[Y],
        `i should have relayed nearly all of k's Y: relayed ${i.exchange.passThrough(Y)}, k holds ${k.supply[Y]}`);
    assert.ok(i.exchange.inherited[Y] > i.exchange.own[Y], 'i values Y for resale, not to eat');

    const Y_edge_ji = net.edgeBetween(j, i);
    const Y_edge_ik = net.edgeBetween(i, k);
    assert.ok(Y_edge_ji.recentFrom(j, Y, sim.tick, 100) > 0 && Y_edge_ji.recentFrom(i, Y, sim.tick, 100) === 0);
    assert.ok(Y_edge_ik.recentFrom(i, Y, sim.tick, 100) > 0 && Y_edge_ik.recentFrom(k, Y, sim.tick, 100) === 0);
});

/**
 * What propagation uniquely adds. Holdings-based valuations already let goods diffuse down
 * need gradients through agents who hold stock, so relaying alone does not prove anything.
 * Here j and i have IDENTICAL own valuations and i holds no Y, so on own need alone nothing can
 * move. Only k's demand, inherited one hop, pulls Y through i. i relays all of it and ends with
 * no stock, a pure middleman that wants none of what it carries.
 */
test('demand pulls goods through a zero-stock middleman only when valuations propagate', () => {
    const run = markup => {
        const sim = new Simulation({params: {seed: 1, initialHumans: 3, numResources: 3, valuationHopMarkup: markup},
            mechanics: {exchange: 'pairwise', linkFormation: 'localProbability'}});
        const ex = sim.world.exchange;
        const net = ex.network;
        const [j, i, k] = sim.world.humans;
        for (const edge of net.edgeList()) net.unlinkEdge(edge);
        net.link(j, i, 0);
        net.link(i, k, 0);
        const full = j.maxEnergyPerResource;
        j.metabolism = [full * 0.9, full * 0.9, full * 0.9];   j.supply = [9, 5, 5];
        i.metabolism = [full * 0.99, full * 0.9, full * 0.9];  i.supply = [0, 5, 5];   // sated in Y, holds none
        k.metabolism = [full * 0.1, full * 0.95, full * 0.95]; k.supply = [0, 40, 40];
        for (let t = 0; t < 30; t++) { sim.tick++; ex.update(); }
        return {j, i, k};
    };

    const Y = 0;
    const own = run(1e9);   // infinite markup: nothing is inherited
    assert.equal(own.k.supply[Y], 0, 'without propagation no Y can reach k');
    assert.equal(own.i.exchange.bought[Y], 0);

    const pulled = run(0.2);
    assert.ok(pulled.k.supply[Y] > 1, `k should receive Y, got ${pulled.k.supply[Y]}`);
    assert.ok(close(pulled.i.exchange.passThrough(Y), pulled.k.supply[Y], 1e-9), 'i relays every unit k receives');
    assert.ok(pulled.i.supply[Y] < 1e-9, 'i ends holding none of it');
});
