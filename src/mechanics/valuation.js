/**
 * Valuation: how an agent prices a resource against its own need.
 *
 * This function is the engine of the whole model. Trade surplus is proportional to the
 * *dispersion* of valuations among neighbours, so the shape of this curve sets how much
 * rent a norm can capture, and therefore how readily hierarchy can bootstrap on top of it.
 *
 * Interface: update(human, sim) — writes human.resource_valuations in place.
 */

export const VALUATION = {
    /**
     * Historical default: sqrt(unmet need / holdings).
     *
     * Rises with metabolic deficit, falls with what the agent already holds. The `+1` keeps
     * an empty-handed agent's valuation finite; the square root damps extremes so a single
     * starving agent cannot dominate the local mean.
     */
    needOverHoldings: {
        update(human, sim) {
            for (let r = 0; r < sim.params.numResources; r++) {
                const v = Math.sqrt(
                    (human.maxEnergyPerResource - human.metabolism[r]) / (human.supply[r] + 1)
                );
                // NaN (negative deficit) or 0 would break the ratio arithmetic downstream.
                human.resource_valuations[r] = v || 1;
            }
        },
    },

    /** Linear variant: no sqrt damping, so local dispersion — and thus surplus — is wider. */
    linearNeedOverHoldings: {
        update(human, sim) {
            for (let r = 0; r < sim.params.numResources; r++) {
                const v = (human.maxEnergyPerResource - human.metabolism[r]) / (human.supply[r] + 1);
                human.resource_valuations[r] = v || 1;
            }
        },
    },

    /** Need only, ignoring holdings. A control isolating the scarcity channel. */
    needOnly: {
        update(human, sim) {
            for (let r = 0; r < sim.params.numResources; r++) {
                const v = Math.sqrt(Math.max(0, human.maxEnergyPerResource - human.metabolism[r]));
                human.resource_valuations[r] = v || 1;
            }
        },
    },
};
