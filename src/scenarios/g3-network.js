/**
 * Pairwise exchange over a social network: does implicit hierarchy emerge without explicit
 * trade objects?
 *
 * Group 3 (network structure and trade). The posted-trade model makes hierarchy explicit
 * (inventors, managers, levels). Here there are no trades to invent or manage: neighbours
 * swap directly, and an agent's effective valuation inherits its neighbours' demand one hop
 * per tick (Bellman max, `valuationHopMarkup` per hop). The questions are whether hubs and
 * brokers appear, how much volume they carry, and how that depends on how the network forms.
 *
 * One scenario per link-formation rule, because sweep grids vary parameters, not mechanics:
 *   - localProbability  static, local, random within reach (linkProbability)
 *   - triadicClosure    static, lineage cliques: parent + neighbours of parent (linksPerBirth)
 *   - usageRewiring     dynamic: idle links decay, brokers introduce their supplier/customer
 *
 * Nobody labours here: labour only buys trade construction, and the pairwise exchange
 * declares `usesLabor: false`, so every agent produces whatever the labour threshold.
 *
 * Status: NEW. Mechanics built 2026-09-27; not yet validated against any prior data.
 */
const base = {
    group: 3,
    params: {},
    terrain: 'wavy',
    probes: ['core', 'network'],
    ticks: 3000,
    samplePeriod: 10,
    seeds: [1, 2, 3, 4, 5],
    grid: {
        valuationHopMarkup: [0.1, 0.2, 0.5, 1e9],   // 1e9: no propagation (own need only)
    },
    primaryMetrics: [
        'core.finalPopulation',
        'network.final_brokerShare',
        'network.final_topDecileThroughputShare',
        'network.final_throughputGini',
        'network.final_degreeGini',
        'network.final_clustering',
        'network.final_flowWeightedLinkLength',
    ],
};

export const networkLocal = {
    ...base,
    name: 'g3-network-local',
    description: 'Pairwise exchange on a static local random network (localProbability).',
    mechanics: {exchange: 'pairwise', linkFormation: 'localProbability'},
};

export const networkTriadic = {
    ...base,
    name: 'g3-network-triadic',
    description: 'Pairwise exchange on a static triadic-closure network (parent + neighbours of parent).',
    mechanics: {exchange: 'pairwise', linkFormation: 'triadicClosure'},
};

export const networkRewiring = {
    ...base,
    name: 'g3-network-rewiring',
    description: 'Pairwise exchange on a use-driven network: idle links decay, brokers introduce trading partners.',
    mechanics: {exchange: 'pairwise', linkFormation: 'usageRewiring'},
};
