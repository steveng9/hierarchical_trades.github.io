/**
 * Metabolism: how supply becomes energy, and how energy drains.
 *
 * Swappable because the default rule is nonlinear in a way that makes welfare comparisons
 * hard to interpret (see below), and Group 1's value accounting depends on being able to
 * read energy as a meaningful quantity. Changing the default would invalidate every result
 * captured so far, so alternatives live beside it and scenarios opt in.
 *
 * Interface:
 *   metabolize(human, sim)      convert held supply into stored energy
 *   spendEnergy(human, amount)  drain energy
 *   totalEnergy(human)          current total
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
    },
};
