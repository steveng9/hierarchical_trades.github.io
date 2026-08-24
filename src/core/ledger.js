/**
 * Resource accounting.
 *
 * Every unit of every resource is produced once, and thereafter either held (by an agent or
 * a trade), consumed, or lost. `checkConservation` verifies that identity, which is the
 * primary correctness invariant of the simulation: a mismatch means resources are being
 * created or destroyed by a bug in the exchange logic.
 *
 * Group 1's value ledger extends from here — "is total value equal to total labour put in,
 * or is value added elsewhere?" is a question about these totals, decomposed by role.
 */
export class Ledger {
    constructor(totalResourceTypes) {
        this.produced = Array(totalResourceTypes).fill(0);
        this.consumed = Array(totalResourceTypes).fill(0);
        this.lost = Array(totalResourceTypes).fill(0);
    }

    recordProduced(r, amount) { this.produced[r] += amount; }
    recordConsumed(r, amount) { this.consumed[r] += amount; }

    /** Resources that left the system without being metabolised — stranded on death, or in a retired trade. */
    recordLost(r, amount) { this.lost[r] += amount; }

    /** What the world should contain: everything produced, minus everything eaten. */
    expected(r) { return this.produced[r] - this.consumed[r]; }

    /** What the world does contain: everything held anywhere, plus everything written off. */
    actual(world, r) { return world.sumAllResources(r) + this.lost[r]; }

    /**
     * Conservation check for one resource.
     * @returns {{resource:number, expected:number, actual:number, drift:number, ok:boolean}}
     */
    checkConservation(world, r, tolerance = 1e-6) {
        const expected = this.expected(r);
        const actual = this.actual(world, r);
        const drift = actual - expected;
        return {resource: r, expected, actual, drift, ok: Math.abs(drift) <= tolerance};
    }

    snapshot() {
        return {
            produced: [...this.produced],
            consumed: [...this.consumed],
            lost: [...this.lost],
        };
    }
}
