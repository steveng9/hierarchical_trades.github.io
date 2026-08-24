/**
 * Group 6 — Evolution of the institutional niche.
 *
 * Status: READY. This is the free result — no new mechanics required.
 *
 * `socialReach` and `productivity` are already heritable with Gaussian mutation, so
 * selection acts on them today. The prediction: hierarchy opens a niche for high-reach,
 * low-productivity institution builders that does not exist when trades are capped at level
 * 1. The diagnostic is `traits.reachProductivityCorr` drifting negative — the population
 * splitting into builders and producers — under unlimited depth but not under `maxTradeLevel: 1`.
 *
 * Contrast `maxTradeLevel: 1` against unlimited, with mutation on. Long runs: selection needs
 * many generations, and at the default `reproductionEnergyThreshold` a generation is
 * hundreds of ticks.
 *
 * ## Deferred
 *
 * `reproduction: 'sexualBlend'` exists but is NOT covered by the goldens and has not been
 * validated. It makes reproduction density-dependent, which couples evolutionary to spatial
 * dynamics — interesting, and a confound to control for before using it.
 */
export const evolution = {
    name: 'g6-evolution',
    group: 6,
    description: 'Does hierarchy create an evolutionary niche for norm builders?',
    params: {},
    mechanics: {},
    probes: ['core', 'traits', 'hierarchy'],
    ticks: 20000,
    samplePeriod: 100,

    grid: {
        maxTradeLevel: [1, null],
    },
    seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    primaryMetrics: [
        'traits.finalReachProductivityCorr',
        'traits.finalMeanReach',
        'traits.finalInventorMeanReach',
        'traits.finalMeanGeneration',
    ],
};
