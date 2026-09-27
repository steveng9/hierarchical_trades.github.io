/**
 * Link formation: how the social network used by the `pairwise` exchange mechanic is wired.
 *
 * Read only when `exchange: 'pairwise'`; under the historical `postedTrades` exchange no
 * network exists and these hooks are never called.
 *
 * Interface (ctx = {sim, world, network}; `world` is passed explicitly because founders are
 * wired while the World is still being constructed, before `sim.world` is assigned):
 *   onHumanAdded(human, ctx)  wire a newborn, or a founder at world construction
 *   onTick(ctx)               per-tick topology maintenance, after exchange
 *
 * Death needs no hook: `PairwiseExchange` removes a dead agent's node, which destroys every
 * edge touching it. That rule is shared by all variants on purpose.
 *
 * ## Who is "within reach"
 *
 * Two agents are candidates for a link when their distance is below the LARGER of their two
 * social reaches: a high-reach agent can link to a low-reach newborn it can see, even if the
 * newborn cannot see it. Networks stay local for ordinary agents, with long links only where
 * someone has the reach to sustain them.
 */
import {distance} from '../core/mathutil.js';

/**
 * Living network members a link from `human` could reach, sorted by id for determinism.
 * Excludes `human` itself, anyone already marked for removal this tick, and anyone not yet in
 * the network. The last matters for founders: they are wired one at a time, so each sees only
 * those wired before it, the same view a newborn has. Otherwise every founder pair would get
 * two chances to link.
 */
export function reachCandidates(human, {world, network}) {
    const wrap = world.wrapDims();
    let maxReach = human.socialReach;
    for (const other of world.humans) {
        if (other.socialReach > maxReach) maxReach = other.socialReach;
    }
    const found = world.grid.query(human.x, human.y, maxReach, wrap);
    const out = [];
    for (const other of found) {
        if (other === human || other.removeFromWorld || !network.hasNode(other)) continue;
        if (distance(human, other, wrap) < Math.max(human.socialReach, other.socialReach)) out.push(other);
    }
    out.sort((a, b) => a.id - b.id);
    return out;
}

/** Whether two agents are within the larger of their reaches of each other. */
export function withinLargerReach(a, b, world) {
    return distance(a, b, world.wrapDims()) < Math.max(a.socialReach, b.socialReach);
}

/** The first living parent of `human`, or null (founders, orphans). */
function livingParent(human, world) {
    for (const id of human.parentIds) {
        const parent = world.humanById.get(id);
        if (parent && !parent.removeFromWorld) return parent;
    }
    return null;
}

/** Draw up to `k` distinct items from `pool` uniformly, without replacement. */
function sampleWithoutReplacement(pool, k, rng) {
    if (k <= 0 || pool.length === 0) return [];
    return rng.shuffle(pool).slice(0, k);
}

/** Link `human` to each reach candidate independently with probability `linkProbability`. */
function linkLocallyAtRandom(human, ctx) {
    const {sim, network} = ctx;
    const p = sim.params.linkProbability;
    for (const other of reachCandidates(human, ctx)) {
        if (sim.rng.next() < p) network.link(human, other, sim.tick);
    }
}

export const LINK_FORMATION = {
    /**
     * A newborn links to each agent within reach with independent probability
     * `linkProbability` (1 = everyone in reach, 0 = no one). The network then changes only
     * at births and deaths, so it is stable and strictly local, with long links only where an
     * agent has the reach for them.
     */
    localProbability: {
        onHumanAdded(human, ctx) {
            linkLocallyAtRandom(human, ctx);
        },
        onTick() {},
    },

    /**
     * Triadic closure: exactly `linksPerBirth` links where possible, each birth closing
     * triangles. From the rule sketched at the end of "Q-learning to foster social norms"
     * (Golob, Substack): link to one node, then to a neighbour of that node.
     *
     *   1. The anchor is the living parent, linked regardless of distance, since a child is
     *      born next to them anyway. A founder (or orphan) anchors on a random agent within
     *      reach instead.
     *   2. The remaining `linksPerBirth - 1` go to distinct random neighbours of the anchor.
     *   3. If the anchor has too few neighbours, the shortfall is drawn from agents within
     *      reach, keeping the rule local. With nobody in reach the newborn gets fewer links, or
     *      none.
     *
     * Triangle-closing grows clustered, village-like cliques along lineages. Hubs are
     * possible, since well-linked agents are more often someone's neighbour, but they
     * are not built in.
     */
    triadicClosure: {
        onHumanAdded(human, ctx) {
            const {sim, world, network} = ctx;
            const target = sim.params.linksPerBirth;
            let anchor = livingParent(human, world);
            if (!anchor || !network.hasNode(anchor)) {
                anchor = sim.rng.pick(reachCandidates(human, ctx)) ?? null;
            }
            if (!anchor) return;
            network.link(human, anchor, sim.tick);

            const linked = new Set([human, anchor]);
            const friendsOfAnchor = [...network.neighbors(anchor)].filter(n => !linked.has(n));
            for (const friend of sampleWithoutReplacement(friendsOfAnchor, target - 1, sim.rng)) {
                network.link(human, friend, sim.tick);
                linked.add(friend);
            }

            const shortfall = target - network.degree(human);
            if (shortfall > 0) {
                const local = reachCandidates(human, ctx).filter(n => !linked.has(n));
                for (const other of sampleWithoutReplacement(local, shortfall, sim.rng)) {
                    network.link(human, other, sim.tick);
                }
            }
        },
        onTick() {},
    },

    /**
     * Use-driven rewiring. Births wire like `localProbability`, then the topology follows
     * the trade:
     *
     *   - Decay: an edge that has carried no flow for `linkIdleTicks` is dropped. Creation
     *     counts as activity, so every new edge gets that long to prove itself.
     *   - Introduction: each tick, each agent with probability `linkIntroductionProbability`
     *     looks at the resource it relays most, meaning the strongest recent inflow of r from
     *     one neighbour j paired with the strongest recent outflow of r to another neighbour k.
     *     If j and k are unlinked but within reach of each other, they link and can
     *     trade directly, which may cut the broker out.
     *
     * Brokerage that survives here reflects structural holes, meaning pairs out of each other's
     * reach, rather than an accident of which links happened to form at birth.
     */
    usageRewiring: {
        onHumanAdded(human, ctx) {
            linkLocallyAtRandom(human, ctx);
        },

        onTick({sim, world, network}) {
            const tick = sim.tick;
            const idle = sim.params.linkIdleTicks;
            for (const edge of network.edgeList()) {
                if (tick - edge.lastActiveTick > idle) network.unlinkEdge(edge);
            }

            const p = sim.params.linkIntroductionProbability;
            if (p <= 0) return;
            const memory = network.flowMemoryTicks;
            for (const broker of world.humans) {
                if (!network.hasNode(broker) || network.degree(broker) < 2) continue;
                if (sim.rng.next() >= p) continue;
                const pair = strongestRelay(broker, network, tick, memory);
                if (pair && !network.edgeBetween(pair.from, pair.to) && withinLargerReach(pair.from, pair.to, world)) {
                    network.link(pair.from, pair.to, tick);
                }
            }
        },
    },
};

/**
 * The (supplier, customer) pair `broker` relays the most of a single resource through:
 * maximises min(inflow from supplier, outflow to customer) over resources and pairs with
 * supplier !== customer. Returns null when the broker relays nothing.
 */
export function strongestRelay(broker, network, tick, memory) {
    let best = null;
    let bestScore = 0;
    const links = network.linksOf(broker);
    for (let r = 0; r < network.numResources; r++) {
        // Top two suppliers and top customer suffice: if the best supplier is also the best
        // customer, the runner-up supplier is the best alternative.
        let in1 = null, in1v = 0, in2 = null, in2v = 0, out1 = null, out1v = 0, out2 = null, out2v = 0;
        for (const [neighbor, edge] of links) {
            const inflow = edge.recentFrom(neighbor, r, tick, memory);
            const outflow = edge.recentFrom(broker, r, tick, memory);
            if (inflow > in1v) { in2 = in1; in2v = in1v; in1 = neighbor; in1v = inflow; }
            else if (inflow > in2v) { in2 = neighbor; in2v = inflow; }
            if (outflow > out1v) { out2 = out1; out2v = out1v; out1 = neighbor; out1v = outflow; }
            else if (outflow > out2v) { out2 = neighbor; out2v = outflow; }
        }
        const options = [[in1, in1v, out1, out1v], [in1, in1v, out2, out2v], [in2, in2v, out1, out1v]];
        for (const [from, inV, to, outV] of options) {
            if (!from || !to || from === to) continue;
            const score = Math.min(inV, outV);
            if (score > bestScore) { bestScore = score; best = {from, to, resource: r, score}; }
        }
    }
    return best;
}
