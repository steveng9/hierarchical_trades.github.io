/**
 * Hierarchy depth sweep — how does capping trade levels affect agents and community?
 *
 * Uses the user-tuned "level-6-stable" parameter set (configs/level-6-stable.json) as the
 * baseline: 3 resources, randomResource terrain, params known to sustain deep hierarchy.
 *
 * The sweep varies maxTradeLevel from 0 (no trading) through 1..6 (capped) to null
 * (uncapped), holding everything else fixed. This isolates the contribution of each
 * additional layer of institutional depth.
 */

const LEVEL_6_STABLE_PARAMS = {
    seed: 12351,
    numResources: 3,
    roughness: 1.1,
    undulation_cutuff: 0.45,
    resourceDepletion: true,
    resourceDepletionRate: 0.02,
    resourceRegenRate: 0.03,
    initialHumans: 500,
    initialEnergy: 50,
    maxHumanEnergy: 100,
    maxHumanAge: 1100,
    production_max: 17.5,
    basicEnergyDepletion: 0.014,
    workEnergyCost: 2,
    numAlternativeResources: 1,
    production_labor_threshold: 1,
    laborPerCycle: 5,
    reproductionEnergyThreshold: 91,
    reproductionMutationRate: 0.05,
    social_reach_multiplier: 0.2,
    tradeAmountPerInvocation: 10,
    laborPerResourceUnit: 0.86,
    fixTradeSurplusRatio: true,
    surplus_multiplier: 0.2,
    build_labor_per_reach: 1.9,
    expected_volume_multiplier: 2,
    clear_trades_every: 80,
    royalty: 0.5,
    min_rate_improvement: 0,
    tradeLoyaltyThreshold: 0,
    inventorPerpetualRoyalty: 0.15,
    minTradeSupplyForHierarchy: 1,
    hierarchicalTradeCostMultiplier: 0.1,
    maxTradeLevel: null,
    surplusToTradeFraction: 0,
    founderGhostReach: true,
};

export const hierarchyDepthSweep = {
    name: 'hierarchy-depth-sweep',
    group: 4,
    description: 'Community outcomes across hierarchy depth caps (0=no trade through uncapped).',
    params: LEVEL_6_STABLE_PARAMS,
    mechanics: {
        tradeSelection: 'invokeAll',
        metabolism: 'classic',
        valuation: 'needOverHoldings',
        pricing: 'dispersionSpread',
        reproduction: 'asexualSplit',
        lifecycle: 'idleWindow',
    },
    terrain: 'randomResource',
    probes: ['core', 'hierarchy', 'lifecycle', 'traits'],
    ticks: 5000,
    samplePeriod: 25,

    grid: {
        maxTradeLevel: [0, 1, 2, 3, 4, 5, 6, null],
    },
    seeds: [12351, 12352, 12353, 12354, 12355],

    primaryMetrics: [
        'core.finalPopulation',
        'core.totalBirths',
        'core.totalDeaths',
        'core.maxLevelReached',
        'core.finalActiveTrades',
        'hierarchy.finalMaxDepth',
        'hierarchy.finalTreeCount',
        'hierarchy.finalLargestTreeSize',
        'hierarchy.finalFracVolumeL2plus',
        'hierarchy.finalMeanManagersPerTrade',
        'lifecycle.meanLifespan',
        'lifecycle.fractionOutlivingFounder',
        'traits.finalMeanReach',
        'traits.finalMeanProductivity',
        'traits.finalReachProductivityCorr',
        'traits.finalMeanGeneration',
    ],
};
