/**
 * Heritable trait distributions — the free evolutionary result (RESEARCH.md 6a).
 *
 * `socialReach` and `productivity` are already heritable with Gaussian mutation, so
 * selection acts on them without any new mechanics. The prediction under test: hierarchy
 * opens a niche for high-reach, low-productivity institution builders that does not exist
 * when trades are capped at level 1.
 *
 * The diagnostic column is `reachProductivityCorr`. A drift toward negative correlation
 * means the population is specialising into builders and producers.
 */
import {Probe} from './probe.js';
import {average} from '../core/mathutil.js';

function quantile(sorted, q) {
    if (sorted.length === 0) return 0;
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function pearson(xs, ys) {
    const n = xs.length;
    if (n < 2) return 0;
    const mx = average(xs);
    const my = average(ys);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        const a = xs[i] - mx;
        const b = ys[i] - my;
        num += a * b;
        dx += a * a;
        dy += b * b;
    }
    const den = Math.sqrt(dx * dy);
    return den === 0 ? 0 : num / den;
}

export class TraitProbe extends Probe {
    static probeName = 'traits';

    sample(sim) {
        const humans = sim.world.humans;
        if (humans.length === 0) return {tick: sim.tick, population: 0};

        const reach = humans.map(h => h.socialReach);
        const prod = humans.map(h => h.productivity);
        const reachSorted = [...reach].sort((a, b) => a - b);
        const prodSorted = [...prod].sort((a, b) => a - b);

        const inventors = humans.filter(h => h.num_trades_built > 0);

        return {
            tick: sim.tick,
            population: humans.length,
            meanReach: average(reach),
            medianReach: quantile(reachSorted, 0.5),
            p90Reach: quantile(reachSorted, 0.9),
            meanProductivity: average(prod),
            medianProductivity: quantile(prodSorted, 0.5),
            p90Productivity: quantile(prodSorted, 0.9),

            // Negative drift = specialisation into builders vs producers.
            reachProductivityCorr: pearson(reach, prod),

            // Do the agents who actually build norms differ from the population?
            fracInventors: inventors.length / humans.length,
            inventorMeanReach: average(inventors.map(h => h.socialReach)),
            inventorMeanProductivity: average(inventors.map(h => h.productivity)),
            reachBuiltCorr: pearson(reach, humans.map(h => h.num_trades_built)),
            meanGeneration: average(humans.map(h => h.generation)),
        };
    }

    summary(sim) {
        const final = this.sample(sim);
        return {
            finalMeanReach: final.meanReach ?? 0,
            finalMeanProductivity: final.meanProductivity ?? 0,
            finalReachProductivityCorr: final.reachProductivityCorr ?? 0,
            finalInventorMeanReach: final.inventorMeanReach ?? 0,
            finalInventorMeanProductivity: final.inventorMeanProductivity ?? 0,
            finalMeanGeneration: final.meanGeneration ?? 0,
        };
    }
}
