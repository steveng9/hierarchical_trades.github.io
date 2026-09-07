/**
 * Metabolism: how supply becomes energy, and how energy drains.
 *
 * Swappable because the default rule is nonlinear in a way that makes welfare comparisons
 * hard to interpret (see below), and Group 1's value accounting depends on being able to
 * read energy as a meaningful quantity. Changing the default would invalidate every result
 * captured so far, so alternatives live beside it and scenarios opt in.
 *
 * Interface:
 *   metabolize(human, sim)              convert held supply into stored energy
 *   spendEnergy(human, amount)          drain energy
 *   totalEnergy(human)                  current total
 *   productionMultiplier(human, sim)    scales produce()/labor() output, in [0, 1] by
 *                                       convention. 1 for every historical variant — this is
 *                                       the hook a diet/health-sensitive variant uses to make
 *                                       malnourishment cost labour rather than just energy.
 */

export const METABOLISM = {
    /**
     * Historical default. Energy absorbed is `consumed * deficit`, so the *rate* of
     * conversion scales with how depleted the agent already is.
     *
     * Two consequences worth remembering when reading any energy figure: intake is
     * superlinear in hunger, and because `deficit` carries units of energy, `metabolism[r]`
     * is not on the same scale as the supply consumed to produce it. This is the rule the
     * goldens were captured under.
     */
    classic: {
        metabolize(human, sim) {
            const params = sim.params;
            for (let r = 0; r < params.numResources; r++) {
                const deficit = human.maxEnergyPerResource - human.metabolism[r];
                const consumed = Math.min(human.supply[r] / 2, 0.2);
                human.supply[r] -= consumed;
                sim.ledger.recordConsumed(r, consumed);
                human.metabolism[r] += consumed * deficit;
            }
        },

        /** Drain proportionally across resources, preserving the agent's energy mix. */
        spendEnergy(human, amount) {
            const total = METABOLISM.classic.totalEnergy(human);
            if (total <= 0) return;
            for (let r = 0; r < human.metabolism.length; r++) {
                human.metabolism[r] -= amount * (human.metabolism[r] / total);
            }
        },

        totalEnergy(human) {
            let total = 0;
            for (let i = 0; i < human.metabolism.length; i++) total += human.metabolism[i];
            return total;
        },

        productionMultiplier() { return 1; },
    },

    /**
     * Linear alternative: one unit consumed becomes one unit of energy, capped at capacity.
     *
     * Makes energy directly comparable to resources produced, which is what the value
     * ledger in Group 1 needs — "is total value equal to total labour put in?" is only
     * answerable if the units line up. Not yet used by any scenario; switching to it
     * requires recapturing goldens.
     */
    linear: {
        metabolize(human, sim) {
            const params = sim.params;
            for (let r = 0; r < params.numResources; r++) {
                const room = human.maxEnergyPerResource - human.metabolism[r];
                if (room <= 0) continue;
                const consumed = Math.min(human.supply[r] / 2, 0.2, room);
                human.supply[r] -= consumed;
                sim.ledger.recordConsumed(r, consumed);
                human.metabolism[r] += consumed;
            }
        },
        spendEnergy(human, amount) { METABOLISM.classic.spendEnergy(human, amount); },
        totalEnergy(human)         { return METABOLISM.classic.totalEnergy(human); },
        productionMultiplier()     { return 1; },
    },

    /**
     * Diet-diversity metabolism: the same conversion as `classic` (the only variant actually
     * calibrated against `workEnergyCost`/`basicEnergyDepletion` — `linear` converts supply
     * to energy too slowly to sustain a population at default costs, which is presumably why
     * it was never picked up by a scenario), but production and labour output scale with the
     * *fraction* of resource types the agent currently holds a meaningful reserve of
     * (`metabolism[r] >= dietWellFedShare * maxEnergyPerResource`).
     *
     * No special-casing per resource count: an agent with access to only half the resource
     * types in the world can satisfy at most half of them, so the multiplier tops out at 0.5
     * automatically. Reproduction stays reachable on that local half-diet (the per-resource
     * energy cap already halves under the same `numResources` symmetry — see
     * `reproductionEnergyThreshold`), but the agent works at half productivity until trade
     * fills in the missing half. Built for the two-community/hub investigation
     * (RESEARCH.md Group 3): malnourishment costs labour, not just a lower energy ceiling.
     */
    dietBalance: {
        metabolize(human, sim)    { METABOLISM.classic.metabolize(human, sim); },
        spendEnergy(human, amount) { METABOLISM.classic.spendEnergy(human, amount); },
        totalEnergy(human)         { return METABOLISM.classic.totalEnergy(human); },

        productionMultiplier(human, sim) {
            // Continuous, not a step function: each resource contributes up to `threshold`
            // toward the total, capped there so an oversupplied resource can't compensate
            // for a missing one. A step function (count resources >= threshold) has a cliff
            // at the boundary — and the initial energy split lands every agent exactly on
            // it, so the first infinitesimal drain would zero every resource's count at
            // once and lock production at 0 forever (nothing can raise metabolism without
            // producing, and nothing can produce at multiplier 0). The continuous version
            // has no such fixed point: a small deficit costs a small amount of multiplier.
            const threshold = sim.params.dietWellFedShare * human.maxEnergyPerResource;
            let sum = 0;
            for (let r = 0; r < human.metabolism.length; r++) {
                sum += Math.min(human.metabolism[r], threshold);
            }
            return sum / (threshold * human.metabolism.length);
        },
    },
};
