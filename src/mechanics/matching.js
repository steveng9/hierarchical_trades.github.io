/**
 * Trade matching: how a level-1 invocation settles against the counterparty it's actually
 * paired with (the two humans that `Trade.trade_partners` records, and that the forest
 * canvas draws a line between).
 *
 * Interface: frictionFraction(actingHuman, requester, sim) -> number in [0, 1]
 *   The fraction of the requester's payout withheld and diverted into the trade's own
 *   `supply[]` instead of reaching them. 0 = historical behaviour (nothing withheld).
 *
 * This only ever taxes the `fulfillRequest` leg of a level-1 invocation — the leg with an
 * identifiable pairwise counterpart. The other leg (drawing down escrow deposited earlier by
 * an anonymous mix of past depositors) has no single partner to measure distance against;
 * each of those depositors already pays this same tax whenever *they* are the one eventually
 * matched. Hierarchical (level-2+) trades settle against a trade's pooled `supply[]`, not a
 * live counterpart, so this mechanic does not apply to them (see RESEARCH.md, "Distance-
 * dependent trade friction").
 */
import {distance} from '../core/mathutil.js';

export const MATCHING = {
    /** Historical default: no distance cost. Multiplying by (1 - 0) is exact, so golden
     * trajectories are untouched. */
    frictionless: {
        frictionFraction() { return 0; },
    },

    /**
     * Smooth, soft-cutoff friction: ~free at short range, ramping toward
     * `tradeFrictionMaxFraction` as the pairwise distance passes the larger of the two
     * agents' own social reaches. A high-reach agent (on either side of the match) keeps
     * long-distance trade cheap; two short-reach agents matched across a long-reach trade's
     * broadcast circle pay steeply for it. The withheld fraction is deposited into
     * `trade.supply[]` (see `Trade.fulfillRequest`), so distance is not wasted — it becomes
     * the same surplus pool that seeds hierarchy.
     */
    distanceFriction: {
        frictionFraction(actingHuman, requester, sim) {
            const wrap = sim.world.wrapDims();
            const reachCap = Math.max(actingHuman.socialReach, requester.socialReach);
            if (reachCap <= 0) return sim.params.tradeFrictionMaxFraction;

            const d = distance(actingHuman, requester, wrap);
            const ramped = 1 - Math.exp(-sim.params.tradeFrictionSteepness * d / reachCap);
            return Math.min(ramped, sim.params.tradeFrictionMaxFraction);
        },
    },
};
