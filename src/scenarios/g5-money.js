/**
 * Group 5 — Emergence of money.
 *
 * Status: READY but UNDERPOWERED. Measurement only, no new mechanics.
 *
 * Menger's question: does one resource become the general intermediary? The probe measures
 * each resource's share of trades and of volume, plus betweenness in the resource-exchange
 * graph.
 *
 * ## The limitation, stated plainly
 *
 * `numResources` is capped at 3 by the terrain generators (`new Array(3)`) and by the RGB
 * rendering path. On three nodes there is only one possible intermediary per pair, so
 * betweenness is nearly degenerate and cannot really test the hypothesis. Share-of-volume
 * and the HHI concentration measure remain informative, and `numResources: 2` vs `3` is
 * still a usable contrast — but a serious money result needs 4-6 resources.
 *
 * Lifting the cap means generalising the terrain generators past hard-coded length-3 cells
 * and decoupling the renderer from RGB. Both are contained changes; neither is done.
 */
export const money = {
    name: 'g5-money',
    group: 5,
    description: 'Does one resource become the general medium of exchange?',
    params: {},
    mechanics: {},
    probes: ['core', 'money', 'hierarchy'],
    ticks: 4000,
    samplePeriod: 20,

    grid: {
        numResources: [2, 3],
    },
    seeds: [1, 2, 3, 4, 5],
    primaryMetrics: ['money.finalDominantResource', 'money.finalVolumeHHI'],
};
