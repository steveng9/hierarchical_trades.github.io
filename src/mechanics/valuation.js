/**
 * Valuation: how an agent prices a resource against its own need.
 *
 * This function is the engine of the whole model. Trade surplus is proportional to the
 * *dispersion* of valuations among neighbours, so the shape of this curve sets how much
 * rent a norm can capture, and therefore how readily hierarchy can bootstrap on top of it.
 *
 * Interface:
 *   valuate(human, supply, sim, out)  pure: write the valuations `human` WOULD hold with
 *                                     holdings `supply` into `out`. Reads the agent's
 *                                     metabolic state but never its `supply`.
 *   update(human, sim)                writes human.resource_valuations from its real supply.
 *
 * `valuate` exists so the pairwise exchange can ask "what would you think of this after the
 * swap?" without mutating the agent. `update` is `valuate` on the agent's own state, with
 * identical arithmetic, so the goldens are unaffected.
 */

/** Build a variant from its pure per-resource rule. */
function variant(valueOf) {
    return {
        valuate(human, supply, sim, out) {
            for (let r = 0; r < sim.params.numResources; r++) {
                // NaN (negative deficit) or 0 would break the ratio arithmetic downstream.
                out[r] = valueOf(human, supply, r) || 1;
            }
            return out;
        },
        update(human, sim) {
            this.valuate(human, human.supply, sim, human.resource_valuations);
        },
    };
}

export const VALUATION = {
    /**
     * Historical default: sqrt(unmet need / holdings).
     *
     * Rises with metabolic deficit, falls with what the agent already holds. The `+1` keeps
     * an empty-handed agent's valuation finite; the square root damps extremes so a single
     * starving agent cannot dominate the local mean.
     */
    needOverHoldings: variant((human, supply, r) =>
        Math.sqrt((human.maxEnergyPerResource - human.metabolism[r]) / (supply[r] + 1))),

    /** Linear variant: no sqrt damping, so local dispersion — and thus surplus — is wider. */
    linearNeedOverHoldings: variant((human, supply, r) =>
        (human.maxEnergyPerResource - human.metabolism[r]) / (supply[r] + 1)),

    /** Need only, ignoring holdings. A control isolating the scarcity channel. */
    needOnly: variant((human, supply, r) =>
        Math.sqrt(Math.max(0, human.maxEnergyPerResource - human.metabolism[r]))),
};
