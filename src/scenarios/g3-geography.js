/**
 * Group 3 — Economic geography and network topology.
 *
 * Status: PARTIAL. Terrain sweeps run today; the network probe does not exist yet.
 *
 * ## The claim under test
 *
 * Institutions should nucleate on the *boundaries* between resource regions rather than in
 * their interiors. Trade surplus is proportional to local valuation dispersion, and
 * dispersion peaks where differently-specialised regions meet — so hierarchy depth should
 * track boundary length, not resource abundance.
 *
 * `stripes` (maximal boundary length) against `slabs` (same specialisation, minimal
 * boundary) is the cleanest available contrast, and both are implemented.
 *
 * ## Not yet implemented
 *
 * - A network probe: agent-agent trade graph and trade-trade hierarchy graph, with degree
 *   distribution, clustering, betweenness, modularity, and the Laplacian spectrum.
 *   `trade.trade_partners` already records normalised pairs with timestamps, so the graph
 *   can be reconstructed without kernel changes.
 * - Village/cluster detection and lineage tracking over time.
 * - The Fiedler-value hypothesis: algebraic connectivity predicting village fission before
 *   it happens.
 */
export const geography = {
    name: 'g3-geography',
    group: 3,
    description: 'Resource-landscape topology and its effect on institutional structure.',
    params: {},
    mechanics: {},
    probes: ['core', 'hierarchy', 'spatial'],
    ticks: 3000,
    samplePeriod: 10,

    /**
     * Terrain is a mechanic, not a parameter, so a terrain sweep runs as a set of scenario
     * variants rather than a `grid`. See `npm run sweep -- --help`.
     */
    terrainVariants: ['wavy', 'stripes', 'slabs', 'randomResource', 'uniform'],
    grid: {
        undulation_cutuff: [0.2, 0.4, 0.6],
    },
    seeds: [1, 2, 3, 4, 5],
};
