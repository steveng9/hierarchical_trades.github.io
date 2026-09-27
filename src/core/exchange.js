/**
 * Exchange engines: the per-tick trading step, behind the `exchange` mechanic.
 *
 * `World` talks to whichever engine is selected through one small interface and never
 * special-cases either:
 *
 *   initialize(founders)        after the founding population exists
 *   onHumanAdded(human)         a birth (also used for each founder by initialize)
 *   onHumanRemoved(human)       a death, at reap time
 *   update()                    one tick of trading
 *   accumulateHeld(r, sum)      add resources held *outside* agents (for conservation)
 *   hashParts()                 extra state for `hashState`; [] leaves the hash unchanged
 *   usesLabor                   whether labour buys anything; if not, nobody becomes a laborer
 *
 * - `PostedTradesExchange` is the historical model, meaning invented, managed, hierarchical
 *   trades. It is a thin adapter over the unchanged `TradeManager`, so the goldens hold.
 * - `PairwiseExchange` has no trade objects at all. Agents exchange directly with their
 *   network neighbours, at rates negotiated from their valuations.
 */
import {SocialNetwork} from './network.js';
import {EVENTS} from './events.js';

// ======================================================================================
// Posted trades (historical)
// ======================================================================================

export class PostedTradesExchange {
    constructor(sim, world) {
        this.sim = sim;
        this.world = world;
        /** Labour pays for founding and running trades. */
        this.usesLabor = true;
    }

    initialize() {}
    onHumanAdded() {}
    onHumanRemoved() {}

    update() {
        this.world.trademanager.update();
    }

    /** Escrow and pooled trade supply. Same summation order as before the seam existed. */
    accumulateHeld(r, sum) {
        for (const trade of this.world.trademanager.trades) {
            sum += trade.escrow[r];
            sum += trade.supply[r];
        }
        return sum;
    }

    hashParts() {
        return [];
    }
}

// ======================================================================================
// Pairwise exchange over a social network
// ======================================================================================

/** Floor under a valuation before taking its log; valuation rules already avoid 0. */
const MIN_VALUATION = 1e-12;
/** Swaps smaller than this (in units of the bought resource) are skipped as noise. */
const MIN_SWAP = 1e-9;
/** Bisection steps when sizing a swap: 2^-14 of the cap is well below any meaningful unit. */
const SWAP_BISECTION_STEPS = 14;

/**
 * Own log-valuations, centred on the agent's own mean.
 *
 * Valuations are only meaningful as ratios; each agent's scale is arbitrary. Centring puts
 * every agent on a shared scale ("how much do I value r relative to my average resource"),
 * which is what makes comparing one agent's valuation to a neighbour's well-defined.
 *
 * @param {ArrayLike<number>} valuations  length >= numResources
 * @param {number} numResources
 * @param {Float64Array} out
 */
export function centeredLogValuations(valuations, numResources, out) {
    let mean = 0;
    for (let r = 0; r < numResources; r++) {
        out[r] = Math.log(Math.max(valuations[r], MIN_VALUATION));
        mean += out[r];
    }
    mean /= numResources;
    for (let r = 0; r < numResources; r++) out[r] -= mean;
    return out;
}

/**
 * The valuation an agent inherits from its neighbours:
 *
 *     inherited[r] = max_k neighbourEffective_k[r] - markup      (-Infinity with no neighbours)
 *
 * This is the resale value of r: pass it one hop to whichever neighbour values it most,
 * less a per-hop markup. A positive markup is what stops the value echoing back and forth
 * between neighbours.
 *
 * @param {Iterable<Float64Array>} neighbourEffective  neighbours' effective vectors (last tick)
 * @param {number} markup  per-hop discount, log units
 * @param {Float64Array} out
 */
export function inheritedValuations(neighbourEffective, markup, out) {
    out.fill(-Infinity);
    for (const theirs of neighbourEffective) {
        for (let r = 0; r < out.length; r++) {
            const offered = theirs[r] - markup;
            if (offered > out[r]) out[r] = offered;
        }
    }
    return out;
}

/**
 * Effective valuation, one Bellman step: `effective[r] = max(own[r], inherited[r])`.
 *
 * The value of holding r is its best use, either eating it (own need) or reselling it
 * (inherited). One rule covers both, with no special case for middlemen. An agent buys r
 * for resale exactly as it would buy r to eat. Iterated once per tick, demand spreads one hop
 * per tick, and a need k hops away is felt `k * markup` below its source.
 */
export function combineEffective(own, inherited, out) {
    for (let r = 0; r < out.length; r++) out[r] = own[r] > inherited[r] ? own[r] : inherited[r];
    return out;
}

/** `combineEffective(own, inheritedValuations(...))`, for callers holding no scratch buffer. */
export function propagateEffective(own, neighbourEffective, markup, out) {
    const inherited = inheritedValuations(neighbourEffective, markup, new Float64Array(own.length));
    return combineEffective(own, inherited, out);
}

/**
 * Negotiate one swap of resource r against resource s between two agents.
 *
 * `m = effective[r] - effective[s]` is an agent's log marginal rate of substitution: one unit
 * of r is worth e^m units of s to them. The agent with the higher m buys r and pays in s.
 * The rate is the geometric mean of the two MRSs, `logPrice = (mA + mB) / 2`, so each side
 * gains exactly half the gap in log terms. That is the symmetric Nash split, and it is
 * invariant to either agent rescaling its valuations.
 *
 * Quantities are symmetric around `quantity` on a log scale: `quantity / sqrt(price)` of r
 * against `quantity * sqrt(price)` of s, so neither resource is privileged as numeraire.
 *
 * @returns {{buyerIsA: boolean, logPrice: number, amountR: number, amountS: number}|null}
 *   null when the gap does not exceed `minGap`
 */
export function negotiateSwap(mA, mB, minGap, quantity) {
    const gap = mA - mB;
    if (!(Math.abs(gap) > minGap)) return null;
    const logPrice = (mA + mB) / 2;
    const sqrtPrice = Math.exp(logPrice / 2);
    return {
        buyerIsA: gap > 0,
        logPrice,
        amountR: quantity / sqrtPrice,
        amountS: quantity * sqrtPrice,
    };
}

/** Per-agent state owned by `PairwiseExchange`, attached as `human.exchange`. */
export class ExchangeState {
    constructor(numResources) {
        this.own = new Float64Array(numResources);
        /** Resale value from neighbours, fixed for the tick (see `inheritedValuations`). */
        this.inherited = new Float64Array(numResources).fill(-Infinity);
        this.effective = new Float64Array(numResources);
        /** False until the first valuation pass: neighbours skip an agent with no view yet. */
        this.ready = false;
        /** Cumulative units received / given away through exchange, per resource. */
        this.bought = new Float64Array(numResources);
        this.sold = new Float64Array(numResources);
    }

    /** Units of r this agent both bought and resold, i.e. its brokered volume of r. */
    passThrough(r) {
        return Math.min(this.bought[r], this.sold[r]);
    }

    totalBought() {
        let s = 0;
        for (let r = 0; r < this.bought.length; r++) s += this.bought[r];
        return s;
    }

    totalPassThrough() {
        let s = 0;
        for (let r = 0; r < this.bought.length; r++) s += this.passThrough(r);
        return s;
    }
}

/**
 * Direct, bilateral exchange between network neighbours. No trade objects, no inventors,
 * no escrow, no hierarchy: any hierarchy or hub that appears is implicit in the flows.
 *
 * Per tick:
 *   1. Each agent's inherited valuation is set for the tick from its neighbours'
 *      previous-tick values (`inheritedValuations`, a Jacobi step, so order-independent).
 *   2. Each agent's own valuation comes from the `valuation` mechanic, unchanged, and its
 *      effective valuation is `max(own, inherited)`. Own and effective are refreshed after
 *      every swap, so later edges see current holdings.
 *   3. Edges are visited in shuffled order. Each weighs every resource pair and makes at
 *      most one swap, on the affordable pair where the two agents' rates differ most, and
 *      only if by more than `minExchangeLogGap` (`negotiateSwap`). The swap runs to the
 *      point where the two rates meet (`sizeSwap`), capped at `tradeAmountPerInvocation`
 *      and at what both sides can afford.
 *   4. The `linkFormation` mechanic maintains the topology.
 *
 * Every swap is an atomic transfer between two agents, so conservation holds without escrow.
 */
export class PairwiseExchange {
    constructor(sim, world) {
        this.sim = sim;
        this.world = world;
        /** No trades to build or run, so labour has no use: every agent produces. */
        this.usesLabor = false;
        this.numResources = sim.params.numResources;
        this.network = new SocialNetwork({
            numResources: this.numResources,
            flowMemoryTicks: sim.params.flowMemoryTicks,
        });
        this.formation = sim.mechanics.linkFormation;
        /** Context handed to link-formation hooks. */
        this.ctx = {sim, world, network: this.network};
        this.totalSwaps = 0;
        this.totalVolume = new Float64Array(this.numResources);
        /** Swaps made in the most recent tick. */
        this.lastTickSwaps = 0;

        // Scratch for `hypotheticalRate`, reused across calls.
        this.scratchSupply = new Float64Array(this.numResources);
        this.scratchValuations = new Float64Array(this.numResources);
        this.scratchOwn = new Float64Array(this.numResources);
    }

    /** Wire the founders one at a time in id order, as if each had just been born. */
    initialize(founders) {
        for (const human of founders) this.onHumanAdded(human);
    }

    onHumanAdded(human) {
        human.exchange = new ExchangeState(this.numResources);
        this.network.addNode(human);
        this.formation.onHumanAdded(human, this.ctx);
    }

    onHumanRemoved(human) {
        this.network.removeNode(human);
    }

    update() {
        this.refreshValuations();
        this.lastTickSwaps = 0;
        for (const edge of this.sim.rng.shuffle(this.network.edgeList())) this.exchangeAcross(edge);
        this.formation.onTick(this.ctx);
    }

    /**
     * Start-of-tick valuation pass.
     *
     * Inherited values are computed for everyone from neighbours' effective values as they
     * stood at the end of the previous tick, before any are overwritten. This is a Jacobi step,
     * so the result does not depend on agent order.
     */
    refreshValuations() {
        const {sim, network} = this;
        const markup = sim.params.valuationHopMarkup;
        const humans = this.world.humans;

        for (const human of humans) {
            const neighbourViews = [];
            for (const neighbour of network.neighbors(human)) {
                if (neighbour.exchange.ready) neighbourViews.push(neighbour.exchange.effective);
            }
            inheritedValuations(neighbourViews, markup, human.exchange.inherited);
        }
        for (const human of humans) {
            this.refreshOwn(human);
            human.exchange.ready = true;
        }
    }

    /**
     * Recompute `human`'s own valuation from its current holdings, and its effective valuation
     * against this tick's fixed inherited values.
     *
     * Called at the start of the tick and again after every swap the agent makes. Without the
     * per-swap refresh, an agent would price every edge in a tick off one stale snapshot:
     * a well-connected agent buys the same resource from all its neighbours at once,
     * overshoots, and sells it all back the next tick.
     */
    refreshOwn(human) {
        const {sim, numResources} = this;
        const state = human.exchange;
        sim.mechanics.valuation.update(human, sim);
        centeredLogValuations(human.resource_valuations, numResources, state.own);
        combineEffective(state.own, state.inherited, state.effective);
    }

    /**
     * Make at most one swap across `edge`: the most advantageous affordable resource pair.
     *
     * Every pair is an option, but only the best is taken. Two agents' per-pair gaps all
     * derive from one difference vector d = effA - effB (a wants r over s exactly when
     * d[r] > d[s]), so swapping on every favourable pair at once would buy a middle-ranked
     * resource on one swap and sell it straight back on another. That is pure churn, and it
     * inflates apparent brokerage. The single widest gap is also the swap each side gains most
     * from.
     */
    exchangeAcross(edge) {
        const deal = this.bestDeal(edge);
        if (!deal) return;
        const {sim} = this;
        const {buyer, seller, r, s, amountR, amountS} = deal;

        this.transfer(edge, seller, buyer, r, amountR);
        this.transfer(edge, buyer, seller, s, amountS);
        this.refreshOwn(buyer);
        this.refreshOwn(seller);
        this.totalSwaps++;
        this.lastTickSwaps++;

        if (sim.events.hasListeners(EVENTS.EXCHANGE_SWAP)) {
            sim.events.emit(EVENTS.EXCHANGE_SWAP, {
                edge, buyer, seller, resourceBought: r, resourcePaid: s,
                amountBought: amountR, amountPaid: amountS, logPrice: deal.logPrice, tick: sim.tick,
            });
        }
    }

    /** The affordable swap across `edge` with the widest rate gap, sized by `sizeSwap`, or null. */
    bestDeal(edge) {
        const {sim, numResources} = this;
        const {a, b} = edge;
        const effA = a.exchange.effective;
        const effB = b.exchange.effective;
        const minGap = sim.params.minExchangeLogGap;
        const quantity = sim.params.tradeAmountPerInvocation;

        let chosen = null;
        let bestGap = 0;
        for (let r = 0; r < numResources; r++) {
            for (let s = r + 1; s < numResources; s++) {
                const mA = effA[r] - effA[s];
                const mB = effB[r] - effB[s];
                const gap = Math.abs(mA - mB);
                if (gap <= bestGap) continue;
                const deal = negotiateSwap(mA, mB, minGap, quantity);
                if (!deal) continue;

                const buyer = deal.buyerIsA ? a : b;
                const seller = deal.buyerIsA ? b : a;
                const affordable = Math.min(1,
                    Math.max(0, seller.supply[r]) / deal.amountR,
                    Math.max(0, buyer.supply[s]) / deal.amountS);
                if (!(deal.amountR * affordable > MIN_SWAP)) continue;

                bestGap = gap;
                chosen = {buyer, seller, r, s, deal, affordable};
            }
        }
        if (!chosen) return null;

        const {buyer, seller, r, s, deal, affordable} = chosen;
        const scale = this.sizeSwap(buyer, seller, r, s, deal, affordable);
        const amountR = deal.amountR * scale;
        if (!(amountR > MIN_SWAP)) return null;
        return {buyer, seller, r, s, amountR, amountS: deal.amountS * scale, logPrice: deal.logPrice};
    }

    /**
     * How much of a negotiated swap to execute, as a fraction of the full `deal` in (0, maxScale].
     *
     * At the agreed price, trade continues only while the buyer still values r over s more than
     * the seller does, and stops where their rates meet. In Edgeworth-box terms, that is the
     * point on the price line where the two agents' curves are tangent. Trading past it would
     * leave both wanting to swap back, so a fixed step larger than the gap made agents
     * oscillate tick after tick. `tradeAmountPerInvocation` is now only the cap.
     *
     * The gap is evaluated at hypothetical holdings through the unchanged `valuation` mechanic,
     * so any valuation rule works. It shrinks monotonically as the swap grows, since each side's
     * own valuation of what it gains falls and of what it gives rises, so bisection
     * applies. A broker whose valuation of r is inherited (resale) rather than own sees no change
     * from the swap and trades the full amount, as it should.
     */
    sizeSwap(buyer, seller, r, s, deal, maxScale) {
        const gapAt = scale => {
            const dR = deal.amountR * scale;
            const dS = deal.amountS * scale;
            const mBuyer = this.hypotheticalRate(buyer, r, s, dR, -dS);
            const mSeller = this.hypotheticalRate(seller, r, s, -dR, dS);
            return mBuyer - mSeller;
        };
        if (gapAt(maxScale) > 0) return maxScale;
        let lo = 0, hi = maxScale;
        for (let i = 0; i < SWAP_BISECTION_STEPS; i++) {
            const mid = (lo + hi) / 2;
            if (gapAt(mid) > 0) lo = mid;
            else hi = mid;
        }
        return lo;
    }

    /**
     * `human`'s effective log rate of r against s if its holdings of r and s changed by dR and
     * dS. Uses the valuation mechanic's pure `valuate` on scratch holdings, so the agent's real
     * state is never touched.
     */
    hypotheticalRate(human, r, s, dR, dS) {
        const supply = this.scratchSupply;
        for (let i = 0; i < this.numResources; i++) supply[i] = human.supply[i];
        supply[r] += dR;
        supply[s] += dS;
        this.sim.mechanics.valuation.valuate(human, supply, this.sim, this.scratchValuations);
        const own = centeredLogValuations(this.scratchValuations, this.numResources, this.scratchOwn);
        const inherited = human.exchange.inherited;
        const valueR = own[r] > inherited[r] ? own[r] : inherited[r];
        const valueS = own[s] > inherited[s] ? own[s] : inherited[s];
        return valueR - valueS;
    }

    transfer(edge, from, to, r, amount) {
        from.supply[r] -= amount;
        to.supply[r] += amount;
        from.exchange.sold[r] += amount;
        to.exchange.bought[r] += amount;
        to.volumeTradedFor[r] += amount;
        this.totalVolume[r] += amount;
        edge.recordFlow(from, r, amount, this.sim.tick, this.network.flowMemoryTicks);
    }

    /** Pairwise exchange holds nothing outside agents. */
    accumulateHeld(_r, sum) {
        return sum;
    }

    hashParts() {
        return [`N${this.network.edgeCount}|${[...this.network.edges.keys()].join(',')}`];
    }
}
