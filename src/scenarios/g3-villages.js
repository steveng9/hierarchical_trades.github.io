/**
 * Two communities, complementary resource halves — does a hub agent emerge?
 *
 * The half-diet/hub-bridging thread of Group 3 (RESEARCH.md, "Inter-community hub agents").
 * Composes three new mechanic variants with the EXISTING trade/hierarchy machinery, unchanged:
 *
 *   - population: 'villages'   — `numVillages` founding communities, each a 2D Gaussian
 *                                 cluster, stationary except for reproduction drift.
 *   - terrain: 'regionalGroups' — resources [0, n) cluster on one side, [n, 2n) on the other.
 *   - metabolism: 'dietBalance' — reproduction stays reachable on a local half-diet, but
 *                                 production is halved until trade completes the diet.
 *   - reproduction: 'asexualSplitCooldown' — the second limiter, so a completed diet after
 *                                 trade doesn't make reproduction unconstrained.
 *
 * No new incentive mechanic for the hub role: a well-positioned agent founding or managing
 * the cross-community trade earns the ordinary inventor/manager spread. This scenario is the
 * test of whether that alone is enough to produce one — before building anything bespoke.
 *
 * `reproductionEnergyThreshold` is set below the local half-diet energy ceiling
 * (`maxHumanEnergy / numResources * (numResources / numVillages)` ≈ half of maxHumanEnergy at
 * numVillages=2) so a village can sustain itself before any inter-community trade exists.
 *
 * Status: NEW — first run, not yet validated against any prior data.
 */
export const villages = {
    name: 'g3-villages',
    group: 3,
    description: 'Two resource-complementary communities; tests whether cross-community trade produces an emergent hub agent.',
    params: {
        numResources: 4,
        numVillages: 2,
        villageSpread: 60,
        initialHumans: 300,
        forestwidth: 1100,
        forestheight: 600,
        dietWellFedShare: 0.5,
        reproductionEnergyThreshold: 40,
        reproductionCooldownTicks: 300,
    },
    mechanics: {
        population: 'villages',
        metabolism: 'dietBalance',
        reproduction: 'asexualSplitCooldown',
    },
    terrain: 'regionalGroups',
    probes: ['core', 'hierarchy', 'spatial'],
    ticks: 4000,
    samplePeriod: 10,
    seeds: [1, 2, 3, 4, 5],

    primaryMetrics: [
        'core.finalPopulation',
        'core.maxLevelReached',
        'hierarchy.finalMaxDepth',
        'hierarchy.finalTreeCount',
        'hierarchy.finalLargestTreeSize',
    ],
};
