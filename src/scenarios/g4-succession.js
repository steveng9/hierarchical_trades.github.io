/**
 * Group 4 — Succession. The Paper 1 core.
 *
 * Status: READY.
 *
 * ## Thesis A
 *
 * Institutions are the mechanism by which norms outlive and outgrow their inventors. The
 * direct test is a survival comparison: trades that acquired a hierarchy against those that
 * did not, plus the fraction that outlive their founder.
 *
 * ## Must-death-precede-institution?
 *
 * At default parameters a trade's surplus only pools once its inventor is dead, so founder
 * mortality is the sole bootstrap into hierarchy. `surplusToTradeFraction` lifts that
 * constraint: above zero, a trade accumulates a treasury while its founder still lives.
 * Sweeping it turns an accident of the implementation into a finding.
 *
 * ## Lifecycle policy matters here
 *
 * This scenario deliberately overrides `lifecycle` to `graceCounter`. Under the default
 * `idleWindow`, a trade dies after one quiet cleanup window and lifespans quantise onto
 * multiples of `clear_trades_every` — a survival curve computed under that policy is
 * measuring the policy. Run the `succession-policy-control` variant below to confirm the
 * effect is not an artifact of the choice.
 */
export const succession = {
    name: 'g4-succession',
    group: 4,
    description: 'Norm lifespan, founder mortality, and the bootstrap into hierarchy.',
    params: {},
    mechanics: {lifecycle: 'graceCounter'},
    probes: ['core', 'lifecycle', 'hierarchy'],
    ticks: 5000,
    samplePeriod: 25,

    grid: {
        surplusToTradeFraction: [0, 0.1, 0.25, 0.5],
    },
    seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    primaryMetrics: [
        'lifecycle.meanLifespanWithHierarchy',
        'lifecycle.meanLifespanWithoutHierarchy',
        'lifecycle.fractionOutlivingFounder',
        'lifecycle.fractionWithHierarchy',
        'core.maxLevelReached',
    ],
};

/** Confirms the survival result is not an artifact of the retirement policy. */
export const successionPolicyControl = {
    ...succession,
    name: 'g4-succession-policy-control',
    description: 'Succession under the original idleWindow retirement policy.',
    mechanics: {lifecycle: 'idleWindow'},
    grid: {surplusToTradeFraction: [0]},
};

/**
 * Thesis B — hierarchy depth as an environmental readout.
 *
 * Patchiness x density x reach. The phase diagram is the emergence evidence: if depth is a
 * smooth function of the environment, the ladder is emergent rather than designed.
 *
 * Note the size: 3 x 3 x 3 cells x 5 seeds = 135 runs. Budget accordingly.
 */
export const depthPhaseDiagram = {
    name: 'g4-depth-phase-diagram',
    group: 4,
    description: 'Maximum hierarchy depth across patchiness, density, and social reach.',
    params: {},
    mechanics: {},
    probes: ['core', 'hierarchy'],
    ticks: 4000,
    samplePeriod: 50,

    grid: {
        undulation_cutuff:       [0.2, 0.4, 0.6],
        initialHumans:           [250, 500, 1000],
        social_reach_multiplier: [0.2, 0.4, 0.8],
    },
    seeds: [1, 2, 3, 4, 5],
    primaryMetrics: ['core.maxLevelReached', 'hierarchy.finalMaxDepth', 'hierarchy.finalTreeCount'],
};
