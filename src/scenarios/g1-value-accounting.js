/**
 * Group 1 — Does hierarchy pay?
 *
 * The single experiment that answers five backlog questions at once: do managers starve the
 * system, is a fiefdom productive or wasteful, how does wealth distribute across roles, is
 * total value equal to labour in, and how do role proportions move over time.
 *
 * Design: sweep `maxTradeLevel` over {0, 1, 2, 3, unlimited} across replicate seeds. Level 0
 * disables trading entirely and is the true null model — without it there is no way to say
 * whether *any* norm layer pays, let alone a hierarchical one.
 *
 * Status: READY.
 *
 * Reading the output: rising `value.fracPooled` alongside falling `value.velocity` is the
 * signature of an extractive hierarchy — resources accumulating in trade supply and out of
 * circulation. Rising population and total energy with depth is the productive case.
 */
export const valueAccounting = {
    name: 'g1-value-accounting',
    group: 1,
    description: 'Welfare and value distribution as a function of hierarchy depth.',
    params: {},
    mechanics: {},
    probes: ['core', 'value', 'hierarchy'],
    ticks: 3000,
    samplePeriod: 10,

    /** The headline sweep. `null` = unlimited depth. */
    grid: {
        maxTradeLevel: [0, 1, 2, 3, null],
    },
    seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    primaryMetrics: [
        'core.finalPopulation',
        'core.maxLevelReached',
        'value.finalFracPooled',
        'value.finalVelocity',
        'value.finalGiniEnergy',
        'value.finalFracManagers',
    ],
};
