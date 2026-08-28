/**
 * Parameter schema: defaults, types, ranges, grouping, and documentation in one place.
 *
 * Previously `PARAMS` was a bare global object mutated by the UI. That worked for a single
 * interactive run and fails for experiments: a sweep needs to know a parameter's type and
 * legal range to generate a grid, a stored run needs its full resolved parameter set to be
 * reproducible, and a typo'd key silently did nothing.
 *
 * `resolveParams()` validates and fills defaults, and throws on unknown keys — so a
 * misspelled parameter in a scenario file fails immediately rather than being ignored.
 *
 * ## Naming
 *
 * Several keys use inconsistent casing (`social_reach_multiplier` vs `initialHumans`) and
 * one is misspelled (`undulation_cutuff`). These are preserved deliberately: saved configs
 * in `localStorage` and the exported `configs/*.json` files key on these exact strings, and
 * renaming would silently break every stored configuration. `ALIASES` below maps corrected
 * spellings onto the canonical keys for new code.
 */

/**
 * @typedef {Object} ParamSpec
 * @property {*}       default
 * @property {'int'|'float'|'bool'|'string'} type
 * @property {number} [min]
 * @property {number} [max]
 * @property {string}  group
 * @property {string}  doc
 * @property {boolean} [affectsDynamics]  false for display-only params (excluded from run hashes)
 */

/** @type {Record<string, ParamSpec>} */
export const PARAM_SCHEMA = {
    // ---- reproducibility -------------------------------------------------------------
    seed: {default: 12345, type: 'int', group: 'run',
        doc: 'Master RNG seed. Fully determines a run given identical parameters.'},

    // ---- display (no effect on dynamics) ---------------------------------------------
    show_social_reach: {default: false, type: 'bool', group: 'display', affectsDynamics: false,
        doc: 'Draw each agent\'s social-reach circle.'},
    margin:           {default: 20,   type: 'int', group: 'display', affectsDynamics: false, doc: 'Canvas margin in px.'},
    leftpanelWidth:   {default: 450,  type: 'int', group: 'display', affectsDynamics: false, doc: 'Left UI column width.'},
    rightpanelwidth:  {default: 750,  type: 'int', group: 'display', affectsDynamics: false, doc: 'Right UI column width.'},
    canvaswidth:      {default: 1240, type: 'int', group: 'display', affectsDynamics: false, doc: 'Canvas width.'},
    updatesPerDraw:   {default: 10,   type: 'int', min: 1, group: 'display', affectsDynamics: false,
        doc: 'Simulation ticks per rendered frame. Interactive speed only; headless ignores it.'},
    reportingPeriod:  {default: 1,    type: 'int', min: 1, group: 'display', affectsDynamics: false, doc: 'Ticks between UI redraws.'},
    periodic_check_interval: {default: 500, type: 'int', group: 'display', affectsDynamics: false, doc: 'ms between debug recomputations.'},
    show_debug_info:  {default: true, type: 'bool', group: 'display', affectsDynamics: false, doc: 'Compute resource-conservation diagnostics.'},

    // ---- environment -----------------------------------------------------------------
    cellSize:     {default: 25,   type: 'int',   min: 1, group: 'environment', doc: 'Forest cell size in px. Smaller = finer resource structure.'},
    forestwidth:  {default: 1100, type: 'int',   min: 1, group: 'environment', doc: 'World width in px.'},
    forestheight: {default: 600,  type: 'int',   min: 1, group: 'environment', doc: 'World height in px.'},
    numResources: {default: 3,    type: 'int',   min: 1, group: 'environment',
        doc: 'Number of tradeable resources. The forest renderer blends palette colours additively.'},
    roughness:        {default: 1,   type: 'float', min: 0, group: 'environment', doc: 'Spatial frequency of the resource noise field.'},
    undulation_cutuff:{default: 0.4, type: 'float', min: 0, max: 1, group: 'environment',
        doc: 'Threshold below which concentration is zeroed. Higher = patchier, more separated regions. [sic: spelling preserved for config compatibility]'},
    resourceDepletion:     {default: true,   type: 'bool',  group: 'environment', doc: 'Enable harvest depletion and regrowth.'},
    resourceDepletionRate: {default: 0.02,   type: 'float', min: 0, group: 'environment', doc: 'Concentration removed per unit harvested.'},
    resourceRegenRate:     {default: 0.0045, type: 'float', min: 0, group: 'environment', doc: 'Concentration restored per cell per tick, toward the baseline grid.'},

    // ---- agents ----------------------------------------------------------------------
    initialHumans:  {default: 500,     type: 'int',   min: 1, group: 'agents', doc: 'Founding population.'},
    initialEnergy:  {default: 50,      type: 'float', min: 0, group: 'agents', doc: 'Starting energy, split evenly across resources.'},
    maxHumanEnergy: {default: 100,     type: 'float', min: 0, group: 'agents', doc: 'Energy ceiling; also sets per-resource metabolic capacity.'},
    maxHumanAge:    {default: 1000000, type: 'int',   min: 1, group: 'agents', doc: 'Mean lifespan in ticks (Gaussian, sd = mean/20). Effectively disabled at the default.'},
    production_max: {default: 3,       type: 'float', min: 0, group: 'agents', doc: 'Upper bound of the initial productivity draw.'},
    basicEnergyDepletion: {default: 0.023, type: 'float', min: 0, group: 'agents', doc: 'Metabolic cost per tick.'},
    workEnergyCost:       {default: 2,     type: 'float', min: 0, group: 'agents', doc: 'Energy cost of producing or labouring.'},
    numAlternativeResources: {default: 1, type: 'int', min: 0, group: 'agents',
        doc: 'Non-metabolic resources. Index 0 is labour, the currency of norm construction.'},
    production_labor_threshold: {default: 0.75, type: 'float', min: 0, group: 'agents',
        doc: 'Production potential below which an agent labours instead. Sets the laborer/producer split.'},
    laborPerCycle:  {default: 4,  type: 'float', min: 0, group: 'agents', doc: 'Labour produced per labouring tick.'},
    reproductionEnergyThreshold: {default: 90,  type: 'float', min: 0, group: 'agents', doc: 'Total energy at which an agent splits.'},
    reproductionMutationRate:    {default: 0.1, type: 'float', min: 0, group: 'agents', doc: 'Trait mutation sd, as a fraction of the trait value.'},
    social_reach_multiplier:     {default: 0.4, type: 'float', min: 0, group: 'agents', doc: 'Scales the right-skewed social-reach draw.'},

    // ---- trading ---------------------------------------------------------------------
    tradeAmountPerInvocation: {default: 1, type: 'float', min: 0.1, group: 'trading',
        doc: 'Units of resource moved per trade invocation. Higher = agents swap supply faster per tick.'},
    laborPerResourceUnit: {default: 0.2, type: 'float', min: 0, group: 'trading', doc: 'Labour consumed per unit of resource moved.'},
    fixTradeSurplusRatio: {default: true, type: 'bool', group: 'trading', doc: 'Hold Ain/Bin constant across trades.'},
    surplus_multiplier:   {default: 0.2, type: 'float', min: 0, group: 'trading',
        doc: 'Spread as a multiple of local valuation dispersion. The inventor\'s margin, and the fuel for hierarchy.'},
    build_labor_per_reach: {default: 0.35, type: 'float', min: 0, group: 'trading', doc: 'Labour cost of founding a trade, per sqrt(reach).'},
    expected_volume_multiplier: {default: 2, type: 'float', min: 0, group: 'trading', doc: 'Scales the projected volume used in the build decision.'},
    clear_trades_every: {default: 50, type: 'int', min: 1, group: 'trading',
        doc: 'Ticks between cleanup passes. Also the window an unused trade survives — a strong confound for lifespan analysis.'},
    royalty: {default: 1, type: 'float', min: 0, group: 'trading', doc: 'Reserved. Currently unread by the kernel.'},
    min_rate_improvement: {default: 0, type: 'float', min: 0, max: 1, group: 'trading',
        doc: 'Fractional improvement over the best local rate required to justify building. 0 admits all. A competition-intensity axis.'},
    tradeLoyaltyThreshold: {default: 0, type: 'float', min: 0, max: 1, group: 'trading',
        doc: 'Switching cost for the bestRate trade-selection mechanic. 0 = pure rate optimization; higher = agents stick with their current trade unless a competitor is better by this fraction.'},

    // ---- hierarchy -------------------------------------------------------------------
    inventorPerpetualRoyalty: {default: 0, type: 'float', min: 0, max: 1, group: 'hierarchy',
        doc: 'Share of surplus the inventor keeps after the trade is managed. 0 sends it all to the trade supply.'},
    minTradeSupplyForHierarchy: {default: 1, type: 'float', min: 0, group: 'hierarchy',
        doc: 'Supply a trade must hold before a higher-level trade may target it.'},
    hierarchicalTradeCostMultiplier: {default: 0.1, type: 'float', min: 0, group: 'hierarchy',
        doc: 'Build cost of a level-2+ trade, relative to level-1.'},

    // ---- experimental controls (default to current behaviour) ------------------------
    maxTradeLevel: {default: null, type: 'int', min: 0, group: 'hierarchy',
        doc: 'Hierarchy depth cap. null = unlimited, 0 = no trades at all, 1 = level-1 only. The control condition for "does hierarchy pay?".'},
    surplusToTradeFraction: {default: 0, type: 'float', min: 0, max: 1, group: 'hierarchy',
        doc: 'Share of surplus pooled in the trade even while the inventor lives. At 0, hierarchy can only bootstrap after the founder dies — see RESEARCH.md 4b.'},
    founderGhostReach: {default: true, type: 'bool', group: 'hierarchy',
        doc: 'Whether a dead inventor keeps projecting reach for their trade. True preserves historical behaviour.'},
};

/** Corrected spellings accepted on input and mapped to canonical keys. */
export const ALIASES = Object.freeze({
    undulation_cutoff: 'undulation_cutuff',
});

/** Ordered groups, for UI sectioning and documentation. */
export const PARAM_GROUPS = ['run', 'environment', 'agents', 'trading', 'hierarchy', 'display'];

/** Keys whose value changes the trajectory. Used for run identity hashing. */
export function dynamicsKeys() {
    return Object.keys(PARAM_SCHEMA)
        .filter(k => PARAM_SCHEMA[k].affectsDynamics !== false)
        .sort();
}

export function defaultParams() {
    const out = {};
    for (const [key, spec] of Object.entries(PARAM_SCHEMA)) out[key] = spec.default;
    return out;
}

function coerce(key, spec, value) {
    if (value === null && spec.min !== undefined && spec.type === 'int') return null; // nullable ints (e.g. maxTradeLevel)
    switch (spec.type) {
        case 'bool':
            return typeof value === 'boolean' ? value : value === 'true' || value === 1;
        case 'int': {
            const n = Math.round(Number(value));
            if (!Number.isFinite(n)) throw new Error(`Parameter "${key}" must be an integer, got ${JSON.stringify(value)}`);
            return n;
        }
        case 'float': {
            const n = Number(value);
            if (!Number.isFinite(n)) throw new Error(`Parameter "${key}" must be a number, got ${JSON.stringify(value)}`);
            return n;
        }
        default:
            return value;
    }
}

/**
 * Validate overrides against the schema and fill defaults.
 *
 * @param {Object} overrides
 * @param {Object} [options]
 * @param {boolean} [options.strict=true]  Throw on unknown keys. Set false when loading
 *                                          historical configs that carry retired keys.
 * @param {boolean} [options.clampRanges=false]  Clamp out-of-range values to the nearest
 *   legal bound and warn, instead of throwing. The interactive UI sets this: a stale saved
 *   config or a slider whose range drifted out of sync with the schema should not leave the
 *   user staring at a blank canvas. Experiments leave it false — a sweep that silently
 *   clamped a parameter would produce data that does not match its own manifest.
 * @returns {Object} a fully-populated, validated parameter set
 */
export function resolveParams(overrides = {}, options = {}) {
    const {strict = true, clampRanges = false} = options;
    const params = defaultParams();
    const unknown = [];

    for (const [rawKey, value] of Object.entries(overrides)) {
        const key = ALIASES[rawKey] ?? rawKey;
        const spec = PARAM_SCHEMA[key];
        if (!spec) {
            unknown.push(rawKey);
            continue;
        }
        let coerced = coerce(key, spec, value);
        if (coerced !== null) {
            const belowMin = spec.min !== undefined && coerced < spec.min;
            const aboveMax = spec.max !== undefined && coerced > spec.max;
            if (belowMin || aboveMax) {
                if (!clampRanges) {
                    throw new Error(belowMin
                        ? `Parameter "${key}" = ${coerced} is below its minimum ${spec.min}`
                        : `Parameter "${key}" = ${coerced} is above its maximum ${spec.max}`);
                }
                const clamped = belowMin ? spec.min : spec.max;
                console.warn(`Parameter "${key}" = ${coerced} out of range; clamped to ${clamped}.`);
                coerced = clamped;
            }
        }
        params[key] = coerced;
    }

    if (unknown.length > 0 && strict) {
        throw new Error(
            `Unknown parameter(s): ${unknown.join(', ')}.\n` +
            `Add them to PARAM_SCHEMA in src/core/params.js, or pass {strict: false} to ignore.`
        );
    }
    return params;
}

/** Stable digest of the dynamics-affecting parameters. Identifies a run configuration. */
export function paramsFingerprint(params) {
    const parts = dynamicsKeys().map(k => `${k}=${JSON.stringify(params[k])}`);
    const s = parts.join('&');
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}
