/**
 * The social network: who can exchange with whom under the `pairwise` exchange mechanic.
 *
 * Pure graph state plus per-edge flow bookkeeping. It never decides *which* edges exist —
 * that is the `linkFormation` mechanic's job — and never moves resources — that is
 * `PairwiseExchange`'s. Keeping all three apart is what lets a topology rule be swapped
 * without touching the exchange rule, and vice versa.
 *
 * Nodes are `Human` objects. Iteration order everywhere is insertion order (Map semantics),
 * so every traversal is deterministic under a fixed seed.
 */

/**
 * An undirected link carrying directed, per-resource flow.
 *
 * Flow is kept as an exponentially-decaying recent total per (direction, resource), decayed
 * lazily on access so an idle edge costs nothing per tick. `flowMemoryTicks` is the e-folding
 * time: a unit that crossed the edge `flowMemoryTicks` ago now counts as 1/e. The cumulative
 * `volume` is kept alongside, undecayed, for whole-run accounting.
 */
export class Edge {
    /**
     * @param {Object} a  endpoint with the lower id
     * @param {Object} b  endpoint with the higher id
     * @param {number} numResources
     * @param {number} tick  creation tick
     */
    constructor(a, b, numResources, tick) {
        this.a = a;
        this.b = b;
        this.key = edgeKey(a, b);
        this.createdTick = tick;
        /** Last tick any resource moved across this edge; creation counts as activity. */
        this.lastActiveTick = tick;
        this.numResources = numResources;
        // [0, R) is a -> b, [R, 2R) is b -> a.
        this.recent = new Float64Array(2 * numResources);
        this.recentStamp = tick;
        this.volume = new Float64Array(numResources);
    }

    /** The endpoint that is not `human`. */
    other(human) {
        return human === this.a ? this.b : this.a;
    }

    /** Offset of the `from -> other` direction in `recent`. */
    directionOffset(from) {
        if (from === this.a) return 0;
        if (from === this.b) return this.numResources;
        throw new Error(`human ${from?.id} is not an endpoint of edge ${this.key}`);
    }

    /** Bring `recent` forward to `tick`, applying the decay accumulated since the last stamp. */
    decayTo(tick, memoryTicks) {
        const elapsed = tick - this.recentStamp;
        if (elapsed <= 0) return;
        const factor = Math.exp(-elapsed / memoryTicks);
        for (let i = 0; i < this.recent.length; i++) this.recent[i] *= factor;
        this.recentStamp = tick;
    }

    /** Record `amount` of resource `r` moving from `from` to the other endpoint. */
    recordFlow(from, r, amount, tick, memoryTicks) {
        this.decayTo(tick, memoryTicks);
        this.recent[this.directionOffset(from) + r] += amount;
        this.volume[r] += amount;
        this.lastActiveTick = tick;
    }

    /** Recent (decayed) flow of `r` in the direction `from -> other`. Read-only. */
    recentFrom(from, r, tick, memoryTicks) {
        return this.recent[this.directionOffset(from) + r] * decayFactor(this, tick, memoryTicks);
    }

    /** Recent (decayed) flow of `r` in both directions. Read-only. */
    recentTotal(r, tick, memoryTicks) {
        return (this.recent[r] + this.recent[this.numResources + r]) * decayFactor(this, tick, memoryTicks);
    }
}

function decayFactor(edge, tick, memoryTicks) {
    const elapsed = tick - edge.recentStamp;
    return elapsed <= 0 ? 1 : Math.exp(-elapsed / memoryTicks);
}

/** Canonical, order-independent key for the pair {a, b}. */
export function edgeKey(a, b) {
    return a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
}

export class SocialNetwork {
    /**
     * @param {Object} options
     * @param {number} options.numResources
     * @param {number} options.flowMemoryTicks  e-folding time of each edge's recent-flow record
     */
    constructor({numResources, flowMemoryTicks}) {
        this.numResources = numResources;
        this.flowMemoryTicks = flowMemoryTicks;
        /** @type {Map<Object, Map<Object, Edge>>} human -> (neighbour -> edge) */
        this.adjacency = new Map();
        /** @type {Map<string, Edge>} */
        this.edges = new Map();
        this.totalLinksMade = 0;
        this.totalLinksRemoved = 0;
    }

    addNode(human) {
        if (!this.adjacency.has(human)) this.adjacency.set(human, new Map());
    }

    hasNode(human) {
        return this.adjacency.has(human);
    }

    /**
     * Remove a node and every edge touching it.
     * @returns {Edge[]} the removed edges
     */
    removeNode(human) {
        const links = this.adjacency.get(human);
        if (!links) return [];
        const removed = [...links.values()];
        for (const edge of removed) this.unlinkEdge(edge);
        this.adjacency.delete(human);
        return removed;
    }

    /**
     * Link two distinct, present nodes. Idempotent: an existing edge is returned unchanged.
     * @returns {Edge|null} the edge, or null for a self-link
     */
    link(a, b, tick) {
        if (a === b) return null;
        const existing = this.edgeBetween(a, b);
        if (existing) return existing;
        if (!this.hasNode(a) || !this.hasNode(b)) {
            throw new Error(`cannot link ${a.id}-${b.id}: both endpoints must be added first`);
        }
        const [lo, hi] = a.id < b.id ? [a, b] : [b, a];
        const edge = new Edge(lo, hi, this.numResources, tick);
        this.edges.set(edge.key, edge);
        this.adjacency.get(a).set(b, edge);
        this.adjacency.get(b).set(a, edge);
        this.totalLinksMade++;
        return edge;
    }

    unlinkEdge(edge) {
        if (!this.edges.delete(edge.key)) return false;
        this.adjacency.get(edge.a)?.delete(edge.b);
        this.adjacency.get(edge.b)?.delete(edge.a);
        this.totalLinksRemoved++;
        return true;
    }

    edgeBetween(a, b) {
        return this.adjacency.get(a)?.get(b) ?? null;
    }

    /** @returns {Iterable<Object>} neighbours of `human` (empty if absent) */
    neighbors(human) {
        return this.adjacency.get(human)?.keys() ?? [];
    }

    /** @returns {Map<Object, Edge>} neighbour -> edge (empty if absent) */
    linksOf(human) {
        return this.adjacency.get(human) ?? new Map();
    }

    degree(human) {
        return this.adjacency.get(human)?.size ?? 0;
    }

    /** Snapshot of all edges, in insertion order. */
    edgeList() {
        return [...this.edges.values()];
    }

    get edgeCount() {
        return this.edges.size;
    }

    get nodeCount() {
        return this.adjacency.size;
    }
}
