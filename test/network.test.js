import test from 'node:test';
import assert from 'node:assert/strict';
import {SocialNetwork, edgeKey} from '../src/core/network.js';
import {LINK_FORMATION, strongestRelay, nearestMembers} from '../src/mechanics/linkFormation.js';
import {Simulation} from '../src/core/simulation.js';
import {EVENTS} from '../src/core/events.js';
import {distance} from '../src/core/mathutil.js';

const node = id => ({id});

function makeNetwork(n, {numResources = 3, flowMemoryTicks = 10} = {}) {
    const net = new SocialNetwork({numResources, flowMemoryTicks});
    const nodes = Array.from({length: n}, (_, i) => node(i + 1));
    for (const h of nodes) net.addNode(h);
    return {net, nodes};
}

test('link is undirected, idempotent, and refuses self-links and unknown nodes', () => {
    const {net, nodes: [a, b]} = makeNetwork(2);
    const edge = net.link(b, a, 0);
    assert.equal(edge.a, a, 'endpoints are ordered by id');
    assert.equal(net.link(a, b, 5), edge, 'relinking returns the existing edge');
    assert.equal(net.edgeCount, 1);
    assert.equal(net.edgeBetween(a, b), net.edgeBetween(b, a));
    assert.equal(net.link(a, a, 0), null);
    assert.throws(() => net.link(a, node(99), 0), /endpoints must be added/);
    assert.equal(edge.key, edgeKey(b, a));
});

test('removing a node destroys every edge touching it and nothing else', () => {
    const {net, nodes: [a, b, c, d]} = makeNetwork(4);
    net.link(a, b, 0); net.link(a, c, 0); net.link(b, c, 0); net.link(c, d, 0);
    const removed = net.removeNode(a);
    assert.equal(removed.length, 2);
    assert.equal(net.edgeCount, 2);
    assert.ok(!net.hasNode(a));
    assert.equal(net.degree(b), 1);
    assert.equal(net.degree(c), 2);
    assert.deepEqual([...net.neighbors(a)], []);
});

test('edge flow is directed, decays exponentially, and keeps an undecayed cumulative total', () => {
    const {net, nodes: [a, b]} = makeNetwork(2, {flowMemoryTicks: 10});
    const edge = net.link(a, b, 0);
    edge.recordFlow(a, 1, 4, 0, 10);
    edge.recordFlow(b, 1, 1, 0, 10);
    assert.equal(edge.recentFrom(a, 1, 0, 10), 4);
    assert.equal(edge.recentFrom(b, 1, 0, 10), 1);
    assert.equal(edge.recentTotal(1, 0, 10), 5);
    assert.ok(Math.abs(edge.recentTotal(1, 10, 10) - 5 / Math.E) < 1e-12, 'one e-folding time later');
    assert.equal(edge.recentTotal(0, 10, 10), 0, 'other resources untouched');
    edge.recordFlow(a, 1, 1, 10, 10);
    assert.ok(Math.abs(edge.recentFrom(a, 1, 10, 10) - (4 / Math.E + 1)) < 1e-12);
    assert.equal(edge.volume[1], 6);
    assert.equal(edge.lastActiveTick, 10);
});

test('strongestRelay finds the supplier/customer pair a broker relays the most through', () => {
    const {net, nodes: [broker, j, k, m]} = makeNetwork(4);
    net.link(broker, j, 0).recordFlow(j, 2, 5, 0, 10);        // j -> broker: 5 of r2
    net.link(broker, k, 0).recordFlow(broker, 2, 3, 0, 10);   // broker -> k: 3 of r2
    net.link(broker, m, 0).recordFlow(broker, 0, 9, 0, 10);   // r0 only leaves: no relay
    const relay = strongestRelay(broker, net, 0, 10);
    assert.equal(relay.from, j);
    assert.equal(relay.to, k);
    assert.equal(relay.resource, 2);
    assert.equal(relay.score, 3);
    assert.equal(strongestRelay(m, net, 0, 10), null);
});

// ---- link formation, in a running simulation --------------------------------------------

const small = {seed: 11, initialHumans: 120, forestwidth: 400, forestheight: 300};
const pairwise = linkFormation => ({exchange: 'pairwise', linkFormation});

function assertNoDanglingEdges(sim) {
    const alive = new Set(sim.world.humans);
    const net = sim.world.exchange.network;
    assert.equal(net.nodeCount, alive.size, 'every living agent is a node, and only they are');
    for (const edge of net.edges.values()) {
        assert.ok(alive.has(edge.a) && alive.has(edge.b), `edge ${edge.key} touches a dead agent`);
    }
}

test('localProbability at p=1 links exactly the founder pairs within the larger reach', () => {
    const sim = new Simulation({params: {...small, linkProbability: 1}, mechanics: pairwise('localProbability')});
    const net = sim.world.exchange.network;
    const humans = sim.world.humans;
    for (let x = 0; x < humans.length; x++) {
        for (let y = x + 1; y < humans.length; y++) {
            const a = humans[x], b = humans[y];
            const inReach = distance(a, b) < Math.max(a.socialReach, b.socialReach);
            assert.equal(!!net.edgeBetween(a, b), inReach, `${a.id}-${b.id}`);
        }
    }
});

test('localProbability at p=0 builds no network', () => {
    const sim = new Simulation({params: {...small, linkProbability: 0}, mechanics: pairwise('localProbability')}).run(50);
    assert.equal(sim.world.exchange.network.edgeCount, 0);
});

test('localProbability founder wiring is sequential: each pair gets one chance, not two', () => {
    // At p = 0.5, doubling each pair's chance would push the linked share of in-reach pairs to ~0.75.
    const sim = new Simulation({params: {...small, initialHumans: 300, linkProbability: 0.5}, mechanics: pairwise('localProbability')});
    const net = sim.world.exchange.network;
    const humans = sim.world.humans;
    let inReach = 0;
    for (let x = 0; x < humans.length; x++) {
        for (let y = x + 1; y < humans.length; y++) {
            const a = humans[x], b = humans[y];
            if (distance(a, b) < Math.max(a.socialReach, b.socialReach)) inReach++;
        }
    }
    const share = net.edgeCount / inReach;
    assert.ok(share > 0.45 && share < 0.55, `linked share of in-reach pairs ${share.toFixed(3)}, want ~0.5`);
});

for (const variant of Object.keys(LINK_FORMATION)) {
    test(`${variant}: deaths leave no dangling edges`, () => {
        const sim = new Simulation({params: small, mechanics: pairwise(variant)}).run(300);
        assert.ok(sim.world.totalDeaths > 0, 'need deaths for this to mean anything');
        assertNoDanglingEdges(sim);
    });
}

test('triadicClosure: each newborn links to its parent and closes triangles through it', () => {
    const sim = new Simulation({params: {...small, linksPerBirth: 3, reproductionEnergyThreshold: 60}, mechanics: pairwise('triadicClosure')});
    const net = sim.world.exchange.network;
    let births = 0, closedTriangle = 0;
    sim.events.on(EVENTS.HUMAN_BORN, ({human, parent}) => {
        births++;
        assert.ok(net.edgeBetween(human, parent), 'newborn must link to its parent');
        assert.ok(net.degree(human) <= 3, `newborn has ${net.degree(human)} links, at most linksPerBirth`);
        const friendsOfParent = [...net.neighbors(human)].filter(n => n !== parent && net.edgeBetween(n, parent));
        if (friendsOfParent.length > 0) closedTriangle++;
    });
    sim.run(400);
    assert.ok(births > 20, `need births, got ${births}`);
    assert.ok(closedTriangle / births > 0.5, `only ${closedTriangle}/${births} births closed a triangle`);
});

test('parentNearest: each newborn links to its parent and exactly its n-1 nearest, reach ignored', () => {
    const n = 4;
    const sim = new Simulation({params: {...small, linksPerBirth: n, reproductionEnergyThreshold: 60},
        mechanics: pairwise('parentNearest')});
    const net = sim.world.exchange.network;
    let births = 0;
    sim.events.on(EVENTS.HUMAN_BORN, ({human, parent}) => {
        births++;
        assert.ok(net.edgeBetween(human, parent), 'newborn must link to its parent');
        assert.equal(net.degree(human), n);
        const expected = nearestMembers(human, n - 1, {world: sim.world, network: net}, new Set([parent]));
        for (const other of expected) assert.ok(net.edgeBetween(human, other), 'must link to the nearest agents');
    });
    sim.run(300);
    assert.ok(births > 20, `need births, got ${births}`);
});

test('parentNearest founders each link to their n nearest earlier founders', () => {
    const sim = new Simulation({params: {...small, linksPerBirth: 3, social_reach_multiplier: 0}, mechanics: pairwise('parentNearest')});
    const net = sim.world.exchange.network;
    const founders = sim.world.humans;
    // Wiring is sequential, so every founder after the third made 3 links; nobody is isolated.
    assert.ok(founders.every(h => net.degree(h) >= 3));
    assert.equal(net.edgeCount, 0 + 1 + 2 + 3 * (founders.length - 3));
});

test('usageRewiring drops links idle longer than linkIdleTicks, and introduces new ones', () => {
    const idle = 40;
    const sim = new Simulation({params: {...small, linkIdleTicks: idle, linkIntroductionProbability: 0.2},
        mechanics: pairwise('usageRewiring')});
    const net = sim.world.exchange.network;
    let introductions = 0;
    const baseLink = net.link.bind(net);
    // Count links made outside a birth: introductions are the only other source.
    let inBirth = false;
    const baseAdded = sim.world.exchange.onHumanAdded.bind(sim.world.exchange);
    sim.world.exchange.onHumanAdded = h => { inBirth = true; try { baseAdded(h); } finally { inBirth = false; } };
    net.link = (a, b, t) => {
        const isNew = !net.edgeBetween(a, b);
        const edge = baseLink(a, b, t);
        if (isNew && edge && !inBirth) introductions++;
        return edge;
    };
    sim.run(400);
    for (const edge of net.edges.values()) {
        assert.ok(sim.tick - edge.lastActiveTick <= idle, `edge ${edge.key} idle ${sim.tick - edge.lastActiveTick} ticks`);
    }
    assert.ok(introductions > 0, 'expected at least one broker introduction');
});
