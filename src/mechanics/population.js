/**
 * Population placement: where the founding population spawns.
 *
 * Interface: place(index, sim) -> {x, y} | null
 *   Called once per founding agent, before it is created. Returning `null` leaves the spot
 *   for `Human` to draw uniformly at random — the historical behaviour. `World` passes no
 *   options through in that case, so nothing about the RNG stream changes and the goldens
 *   hold exactly.
 *
 * A `villages` placement pairs naturally with a terrain generator that groups resources into
 * `numVillages` regions (e.g. `regionalGroups` in terrain.js) — that pairing is a scenario's
 * choice, not something this module assumes or enforces.
 */

export const POPULATION = {
    /** Historical default: no placement override. */
    uniform: {
        place() { return null; },
    },

    /**
     * `numVillages` stationary founding communities, each a 2D Gaussian cluster
     * (`villageSpread` px standard deviation) centred on evenly-spaced points across the
     * map. Founding agents are assigned to villages round-robin, so every village starts
     * with a roughly equal population. Reproduction (`asexualSplit` and friends) still
     * places children 5-30px from their parent, so lineages drift and villages can bud —
     * this mechanic only shapes the founding generation.
     */
    villages: {
        place(index, sim) {
            const params = sim.params;
            const v = index % params.numVillages;
            const cx = ((v + 0.5) / params.numVillages) * params.forestwidth;
            const cy = params.forestheight / 2;
            const x = cx + sim.rng.normal(0, params.villageSpread);
            const y = cy + sim.rng.normal(0, params.villageSpread);
            return {
                x: Math.max(0, Math.min(params.forestwidth - 1, x)),
                y: Math.max(0, Math.min(params.forestheight - 1, y)),
            };
        },
    },
};
