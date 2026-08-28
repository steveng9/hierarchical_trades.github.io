/**
 * The historical configuration, unchanged.
 *
 * Every default parameter and every default mechanic. This is the rule set the golden
 * trajectories were captured under and the reference every other scenario is a departure
 * from. Do not change it — add a new scenario instead.
 */
export const baseline = {
    name: 'baseline',
    group: 0,
    description: 'Pre-refactor default configuration. The reference point for all comparisons.',
    params: {},
    mechanics: {},
    probes: ['core', 'hierarchy'],
    ticks: 2000,
    samplePeriod: 10,
    tradeSelection: 'bestRate',
};
