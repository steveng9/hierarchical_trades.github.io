/**
 * Trade retirement policy — when a norm is considered dead.
 *
 * This is a measurement-critical seam. Under the default policy a trade dies after a single
 * quiet cleanup window, so observed trade lifespans are quantised by `clear_trades_every`
 * and cluster on its multiples. Any survival analysis (RESEARCH.md 4a) run under
 * `idleWindow` is measuring the policy as much as the trade, so the softer policies exist to
 * separate those.
 *
 * Interface: shouldDeprecate(trade, sim) -> string|null   (a cause, or null to keep alive)
 */

export const LIFECYCLE = {
    /**
     * Historical default. A level-1 trade must have been invoked on BOTH sides during the
     * window; a hierarchical trade only on its agent-facing side.
     */
    idleWindow: {
        shouldDeprecate(trade) {
            if (trade.isHierarchical) {
                const side = trade.agentSide();
                return trade.invocations_since_last_checked[side] === 0 ? 'idle' : null;
            }
            const {A, B} = trade.invocations_since_last_checked;
            return (A === 0 || B === 0) ? 'idle' : null;
        },
    },

    /**
     * Tolerate `graceWindows` consecutive quiet windows before retiring.
     *
     * De-quantises lifespan: a trade that is merely intermittent survives, so measured
     * duration reflects usage rather than the cleanup cadence. Recommended for 4a.
     */
    graceCounter: {
        graceWindows: 3,
        shouldDeprecate(trade) {
            const idle = LIFECYCLE.idleWindow.shouldDeprecate(trade) !== null;
            trade._idleWindows = idle ? (trade._idleWindows ?? 0) + 1 : 0;
            return trade._idleWindows >= LIFECYCLE.graceCounter.graceWindows ? 'idle-sustained' : null;
        },
    },

    /** Never retire. Isolates the effect of the retirement policy itself. */
    never: {
        shouldDeprecate() { return null; },
    },
};
