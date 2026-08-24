/**
 * Invariant checking.
 *
 * The simulation relies on assertions to catch resource-conservation violations and
 * floating-point drift. In headless sweeps a thrown assertion should fail the run loudly
 * rather than be swallowed, so this stays a hard throw. `SimulationError` carries the
 * tick and a context bag so a failure in run 847 of a sweep is diagnosable without a
 * repro session.
 */

export class SimulationError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = 'SimulationError';
        this.context = context;
    }
}

export function assert(condition, message, context = {}) {
    if (!condition) {
        throw new SimulationError(message || 'Assertion failed', context);
    }
}
