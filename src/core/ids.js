/**
 * Per-simulation identifier allocation.
 *
 * Replaces the `Human.lastHumanId` / `Trade.lastTradeId` static counters. Statics are
 * process-global: two simulations in one process (a sweep worker, or two tests in the same
 * file) would interleave their id sequences and silently break reproducibility. Ids live on
 * the simulation instead.
 *
 * Starting values are configurable because the original counters disagreed — humans were
 * 1-based and trades 0-based — and ids appear in trajectory hashes.
 */
export class IdAllocator {
    /** @param {Object<string,number>} firstIds  starting id per sequence (default 1) */
    constructor(firstIds = {}) {
        this.firstIds = firstIds;
        this.counters = new Map();
    }

    next(kind) {
        const value = this.counters.has(kind)
            ? this.counters.get(kind) + 1
            : (this.firstIds[kind] ?? 1);
        this.counters.set(kind, value);
        return value;
    }

    /** Most recent id issued for `kind`, or null if none. */
    peek(kind) {
        return this.counters.has(kind) ? this.counters.get(kind) : null;
    }

    reset() {
        this.counters.clear();
    }
}
