/**
 * Network probe: implicit hierarchy under the pairwise exchange.
 *
 * With no trade objects there is no explicit hierarchy to count. What is measurable is
 * structure in the graph and in the flows over it:
 *
 *   topology     degree distribution (mean, max, Gini), global clustering (transitivity), and
 *                mean link length (how local the graph is)
 *   flow         share of links carrying anything recently, and the flow-weighted mean link
 *                length (how far goods move per hop)
 *   hubs         concentration of per-agent recent throughput (Gini, top-decile share)
 *   brokerage    share of all volume bought that the buyer later resold (pass-through). This
 *                is the direct measure of middlemen.
 *
 * Returns null samples (and an empty summary) under the posted-trades exchange, which has no
 * network.
 */
import {Probe} from './probe.js';
import {gini, distance} from '../core/mathutil.js';

/** Recent flow below this counts as idle. Matches the network view's visibility cutoff. */
const ACTIVE_FLOW = 0.01;

export class NetworkProbe extends Probe {
    static probeName = 'network';

    constructor() {
        super();
        this.last = null;
    }

    sample(sim) {
        const network = sim.world.exchange?.network;
        if (!network) return null;
        const row = measureNetwork(sim, network);
        this.last = row;
        return row;
    }

    summary(sim) {
        const row = this.sample(sim) ?? this.last;
        if (!row) return {};
        const out = {};
        for (const [k, v] of Object.entries(row)) if (k !== 'tick') out[`final_${k}`] = v;
        out.totalSwaps = sim.world.exchange.totalSwaps;
        return out;
    }
}

/** One flat row of network metrics. Exported for tests and ad-hoc analysis. */
export function measureNetwork(sim, network) {
    const tick = sim.tick;
    const memory = network.flowMemoryTicks;
    const wrap = sim.world.wrapDims();
    const R = network.numResources;
    const humans = sim.world.humans;

    const degrees = humans.map(h => network.degree(h));
    const throughput = new Map(humans.map(h => [h, 0]));

    let activeEdges = 0, totalRecent = 0, lengthSum = 0, flowLengthSum = 0;
    for (const edge of network.edges.values()) {
        let recent = 0;
        for (let r = 0; r < R; r++) recent += edge.recentTotal(r, tick, memory);
        const length = distance(edge.a, edge.b, wrap);
        lengthSum += length;
        flowLengthSum += recent * length;
        totalRecent += recent;
        if (recent >= ACTIVE_FLOW) activeEdges++;
        throughput.set(edge.a, (throughput.get(edge.a) ?? 0) + recent);
        throughput.set(edge.b, (throughput.get(edge.b) ?? 0) + recent);
    }

    const perAgent = [...throughput.values()].sort((a, b) => b - a);
    const topDecile = perAgent.slice(0, Math.max(1, Math.ceil(perAgent.length / 10)));
    const throughputSum = perAgent.reduce((a, b) => a + b, 0);

    let bought = 0, relayed = 0;
    for (const h of humans) {
        bought += h.exchange.totalBought();
        relayed += h.exchange.totalPassThrough();
    }

    const edges = network.edgeCount;
    return {
        tick,
        nodes: humans.length,
        edges,
        meanDegree: humans.length ? 2 * edges / humans.length : 0,
        maxDegree: degrees.length ? Math.max(...degrees) : 0,
        degreeGini: gini(degrees),
        clustering: transitivity(humans, network),
        meanLinkLength: edges ? lengthSum / edges : 0,
        flowWeightedLinkLength: totalRecent > 0 ? flowLengthSum / totalRecent : 0,
        activeEdgeFrac: edges ? activeEdges / edges : 0,
        recentFlow: totalRecent,
        throughputGini: gini(perAgent),
        topDecileThroughputShare: throughputSum > 0 ? topDecile.reduce((a, b) => a + b, 0) / throughputSum : 0,
        brokerShare: bought > 0 ? relayed / bought : 0,
        swapsLastTick: sim.world.exchange.lastTickSwaps,
    };
}

/** Global clustering coefficient: 3 x triangles / connected triples. */
export function transitivity(humans, network) {
    let closed = 0, triples = 0;
    for (const h of humans) {
        const nbrs = [...network.neighbors(h)];
        const k = nbrs.length;
        triples += k * (k - 1) / 2;
        for (let i = 0; i < k; i++) {
            for (let j = i + 1; j < k; j++) {
                if (network.edgeBetween(nbrs[i], nbrs[j])) closed++;
            }
        }
    }
    // Each triangle is counted once at each of its three corners, which is what the formula wants.
    return triples > 0 ? closed / triples : 0;
}
