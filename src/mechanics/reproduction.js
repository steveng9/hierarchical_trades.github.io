/**
 * Reproduction and inheritance.
 *
 * The evolutionary channel of the model. Because `socialReach` and `productivity` are
 * heritable with mutation, selection can act on them — which is what makes "does hierarchy
 * open a niche for high-reach, low-productivity institution builders?" (RESEARCH.md 6a)
 * answerable with no new mechanics at all.
 *
 * Interface: tryReproduce(human, sim) -> Human|null
 */
import {wrapDelta} from '../core/mathutil.js';

/** Multiplicative Gaussian mutation, floored so a trait can never reach zero or invert. */
function mutate(rng, value, rate) {
    return Math.max(0.001, value * (1 + rng.normal(0, rate)));
}

/**
 * Constrain a spawn coordinate to the map: wrap it around the far edge when `params.wrapped`
 * (so lineages can drift all the way around instead of piling up at the boundary), otherwise
 * clamp to the edge as before.
 */
function place(coord, size, wrapped) {
    if (wrapped) return ((coord % size) + size) % size;
    return Math.max(0, Math.min(size - 1, coord));
}

/** Midpoint of two parents, short way around the seam when wrapped — plain averaging would
 *  place it on the far side of the map for two parents near opposite edges. */
function midpoint(a, b, size, wrapped) {
    return a + (wrapped ? wrapDelta(b - a, size) : b - a) / 2;
}

export const REPRODUCTION = {
    /**
     * Historical default: asexual fission above an energy threshold.
     *
     * The child takes half the parent's energy and settles 5–30px away, so lineages drift
     * across the map over generations. That drift is the only form of movement in the model
     * — agents themselves never move — and is the mechanism behind village budding in
     * Group 3.
     */
    asexualSplit: {
        tryReproduce(human, sim) {
            const params = sim.params;
            if (human.totalEnergy() < params.reproductionEnergyThreshold) return null;

            const childEnergy = human.totalEnergy() / 2;
            human.spendEnergy(childEnergy);

            const angle = sim.rng.next() * 2 * Math.PI;
            const maxSpawnDist = 5 + 500 * params.reproductionMutationRate;
            const dist = sim.rng.float(5, maxSpawnDist);
            const cx = place(human.x + Math.cos(angle) * dist, params.forestwidth, params.wrapped);
            const cy = place(human.y + Math.sin(angle) * dist, params.forestheight, params.wrapped);

            const child = sim.world.createHuman({x: cx, y: cy, energy: childEnergy});
            child.socialReach = mutate(sim.rng, human.socialReach, params.reproductionMutationRate);
            child.productivity = mutate(sim.rng, human.productivity, params.reproductionMutationRate);
            child.parentIds = [human.id];
            child.generation = human.generation + 1;
            child.discoverTradesAtBirth();
            return child;
        },
    },

    /**
     * Sexual reproduction: both parents must clear the threshold and be within reach of
     * each other. Traits are blended, then mutated.
     *
     * EXPERIMENTAL — not covered by the goldens and not yet used by any scenario. Note the
     * behavioural implication before using it: because mating requires a partner in reach,
     * reproduction becomes density-dependent, which couples the evolutionary dynamics to
     * the spatial dynamics in a way asexual fission does not.
     */
    sexualBlend: {
        tryReproduce(human, sim) {
            const params = sim.params;
            if (human.totalEnergy() < params.reproductionEnergyThreshold) return null;

            const candidates = sim.world.humansWithinReach(human).filter(
                other => other !== human && other.totalEnergy() >= params.reproductionEnergyThreshold
            );
            if (candidates.length === 0) return null;
            const mate = sim.rng.pick(candidates);

            // Each parent contributes a quarter of its energy.
            const contribution = human.totalEnergy() / 4 + mate.totalEnergy() / 4;
            human.spendEnergy(human.totalEnergy() / 4);
            mate.spendEnergy(mate.totalEnergy() / 4);

            const angle = sim.rng.next() * 2 * Math.PI;
            const maxSpawnDist = 5 + 500 * params.reproductionMutationRate;
            const dist = sim.rng.float(5, maxSpawnDist);
            const midX = midpoint(human.x, mate.x, params.forestwidth, params.wrapped);
            const midY = midpoint(human.y, mate.y, params.forestheight, params.wrapped);
            const cx = place(midX + Math.cos(angle) * dist, params.forestwidth, params.wrapped);
            const cy = place(midY + Math.sin(angle) * dist, params.forestheight, params.wrapped);

            const child = sim.world.createHuman({x: cx, y: cy, energy: contribution});
            child.socialReach = mutate(sim.rng, (human.socialReach + mate.socialReach) / 2, params.reproductionMutationRate);
            child.productivity = mutate(sim.rng, (human.productivity + mate.productivity) / 2, params.reproductionMutationRate);
            child.parentIds = [human.id, mate.id];
            child.generation = Math.max(human.generation, mate.generation) + 1;
            child.discoverTradesAtBirth();
            return child;
        },
    },

    /** Disable reproduction entirely. A fixed-population control. */
    none: {
        tryReproduce() { return null; },
    },

    /**
     * Asexual fission with a cooldown: identical to `asexualSplit`, but an agent must also
     * have waited `reproductionCooldownTicks` since its last birth event (its own, or the
     * event that created it).
     *
     * Energy alone gates *whether* reproduction is possible; this adds *how often*. Needed
     * once a completed diet (via trade) would otherwise make energy trivially abundant and
     * reproduction effectively continuous — see the diet-balance metabolism variant and
     * RESEARCH.md Group 3's half-diet/hub investigation. At `reproductionCooldownTicks = 0`
     * this is identical to `asexualSplit`.
     */
    asexualSplitCooldown: {
        tryReproduce(human, sim) {
            const params = sim.params;
            if (human.totalEnergy() < params.reproductionEnergyThreshold) return null;
            if (sim.tick - human.lastReproductionTick < params.reproductionCooldownTicks) return null;

            const child = REPRODUCTION.asexualSplit.tryReproduce(human, sim);
            if (child) {
                human.lastReproductionTick = sim.tick;
                child.lastReproductionTick = sim.tick;
            }
            return child;
        },
    },
};
