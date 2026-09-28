/**
 * Parameter relevance: the `usedBy` tags in PARAM_SCHEMA and FAMILY_REQUIRES in the registry.
 *
 * The control panel hides every parameter the selected mechanics do not use, so a wrong tag
 * silently hides a knob that still changes the run. These tests keep the tags honest:
 *
 *   - Tags name only registered families and variants, and the panel offers every variant.
 *   - Hidden means inert: under each variant of each family, perturbing any hidden parameter
 *     leaves the trajectory unchanged. This is what makes a newly added variant fail loudly
 *     until it is added to the tags of the parameters it reads.
 *   - Tagged means used: each tagged parameter changes the trajectory in at least one
 *     selection where it is shown, which catches stale tags.
 *   - Scenarios sweep only parameters their own mechanics use.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PARAM_SCHEMA, defaultParams} from '../src/core/params.js';
import {MECHANICS_REGISTRY, FAMILY_REQUIRES} from '../src/mechanics/registry.js';
import {
    isParamRelevant, isFamilyActive, completeSelection, withActivatingParents, mentionedVariants,
    relevantParams,
} from '../src/mechanics/relevance.js';
import {Simulation} from '../src/core/simulation.js';
import {hashWorldState} from '../src/core/statehash.js';
import {SCENARIOS} from '../src/scenarios/index.js';

const small = {seed: 3, initialHumans: 120, forestwidth: 400, forestheight: 300};
const TICKS = 150;

// ---- static consistency ------------------------------------------------------------------

function assertRegistered(pairs, where) {
    for (const [family, variant] of pairs) {
        assert.ok(MECHANICS_REGISTRY[family], `${where}: unknown family "${family}"`);
        assert.ok(MECHANICS_REGISTRY[family][variant], `${where}: unknown ${family} variant "${variant}"`);
    }
}

test('usedBy tags and FAMILY_REQUIRES name only registered families and variants', () => {
    for (const [key, spec] of Object.entries(PARAM_SCHEMA)) {
        if (spec.usedBy === undefined) continue;
        assert.ok(Array.isArray(spec.usedBy), `${key}.usedBy must be a list of clauses`);
        assertRegistered(mentionedVariants(spec.usedBy), `PARAM_SCHEMA.${key}.usedBy`);
    }
    for (const [family, clauses] of Object.entries(FAMILY_REQUIRES)) {
        assert.ok(MECHANICS_REGISTRY[family], `FAMILY_REQUIRES: unknown family "${family}"`);
        assertRegistered(mentionedVariants(clauses), `FAMILY_REQUIRES.${family}`);
    }
});

test('clauses: absent = always, [] = never, and a clause needs its family active', () => {
    assert.equal(isParamRelevant('seed', {exchange: 'pairwise'}), true);
    assert.equal(isParamRelevant('royalty', {}), false);
    assert.equal(isParamRelevant('tradeFrictionSteepness', {matching: 'distanceFriction'}), true);
    // Still set to distanceFriction, but matching itself is inactive under pairwise.
    assert.equal(isParamRelevant('tradeFrictionSteepness', {matching: 'distanceFriction', exchange: 'pairwise'}), false);
    assert.equal(isFamilyActive('linkFormation', {}), false);
    assert.equal(isFamilyActive('linkFormation', {exchange: 'pairwise'}), true);
    // Any clause suffices: reach is inert under parentNearest unless something else reads it.
    const nearest = {exchange: 'pairwise', linkFormation: 'parentNearest'};
    assert.equal(isParamRelevant('social_reach_multiplier', nearest), false);
    assert.equal(isParamRelevant('social_reach_multiplier', {...nearest, reproduction: 'sexualBlend'}), true);
});

test('withActivatingParents adds the parent choices a family needs, and refuses contradictions', () => {
    assert.deepEqual(withActivatingParents({linkFormation: 'usageRewiring'}),
        {linkFormation: 'usageRewiring', exchange: 'pairwise'});
    assert.deepEqual(withActivatingParents({metabolism: 'linear'}), {metabolism: 'linear'});
    assert.throws(() => withActivatingParents({linkFormation: 'usageRewiring', exchange: 'postedTrades'}), /inactive/);
});

test('the control panel offers exactly the registered variants of every family', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    for (const [family, variants] of Object.entries(MECHANICS_REGISTRY)) {
        const select = html.match(new RegExp(`<select id="mechanic_${family}"[^>]*>([\\s\\S]*?)</select>`));
        assert.ok(select, `index.html has no <select id="mechanic_${family}">`);
        const offered = [...select[1].matchAll(/<option value="([^"]+)"/g)].map(m => m[1]).sort();
        assert.deepEqual(offered, Object.keys(variants).sort(), `mechanic_${family} options`);
    }
});

test('every control-panel input is a schema parameter', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const panel = html.slice(html.indexOf('<div id="parameters">'), html.indexOf('id="mechanics-panel"'));
    for (const [, id] of panel.matchAll(/<input[^>]*\bid="([^"]+)"/g)) {
        assert.ok(PARAM_SCHEMA[id], `index.html input "${id}" is not in PARAM_SCHEMA`);
    }
});

// ---- dynamic: hidden means inert, tagged means used -----------------------------------------

/**
 * The trajectory, without two fields that are state but not dynamics: `socialReach`, which is
 * drawn for every agent but read only by some mechanics (its effects appear elsewhere when it
 * matters), and the length of `alternativeSupply`, which is sized by numAlternativeResources
 * and stays all-zero when nothing labours. Its sum is kept.
 */
function trajectoryDigest(sim) {
    const humans = sim.world.humans.map(h => ({
        id: h.id, x: h.x, y: h.y, supply: h.supply, metabolism: h.metabolism, age: h.age,
        productivity: h.productivity, socialReach: 0,
        alternativeSupply: [h.alternativeSupply.reduce((a, b) => a + b, 0)],
    }));
    return hashWorldState(sim.tick, humans, sim.world.trademanager.trades, sim.world.exchange.hashParts());
}

/** Trajectory digests, memoised: the same baseline serves many perturbations. */
const digests = new Map();
function runDigest(selection, params, ticks = TICKS) {
    const id = JSON.stringify([selection, params, ticks]);
    if (!digests.has(id)) {
        digests.set(id, trajectoryDigest(new Simulation({params, mechanics: selection}).run(ticks)));
    }
    return digests.get(id);
}

/** A value different enough from `value` to show an effect, inside the schema's bounds. */
function perturb(spec, value) {
    if (spec.type === 'bool') return !value;
    if (value === null) return 1;                                   // unlimited -> capped
    let next = value === 0 ? (spec.max ?? 10) / 2 : value / 4;
    if (spec.type === 'int') next = Math.round(next) === value ? value + 1 : Math.round(next);
    if (spec.min !== undefined) next = Math.max(spec.min, next);
    if (spec.max !== undefined) next = Math.min(spec.max, next);
    return next;
}

function perturbed(params, keys) {
    const out = {...params};
    for (const key of keys) out[key] = perturb(PARAM_SCHEMA[key], params[key]);
    return out;
}

const DYNAMIC_KEYS = Object.keys(PARAM_SCHEMA).filter(k => PARAM_SCHEMA[k].affectsDynamics !== false);
const SMALL_PARAMS = {...defaultParams(), ...small};

/**
 * The selection under which the fewest parameters are relevant, found greedily. Deviating
 * from it one variant at a time exposes reads that a busier base would mask: reach under
 * sexualBlend, say, is only its own clause when neither posted trades nor a reach-based link
 * rule already makes reach relevant.
 */
function sparsestSelection() {
    let best = completeSelection({});
    const count = sel => relevantParams(sel).length;
    for (let improved = true; improved;) {
        improved = false;
        for (const [family, variants] of Object.entries(MECHANICS_REGISTRY)) {
            for (const variant of Object.keys(variants)) {
                const candidate = {...best, [family]: variant};
                if (count(candidate) < count(best)) { best = candidate; improved = true; }
            }
        }
    }
    return best;
}

/**
 * Two bases (the defaults, and the sparsest selection), each alone and with every variant of
 * every family swapped in, along with the parent choices that activate it.
 */
function selectionsToCheck() {
    const seen = new Map();
    const add = sel => seen.set(JSON.stringify(completeSelection(sel)), sel);
    for (const base of [{}, sparsestSelection()]) {
        add(base);
        for (const [family, variants] of Object.entries(MECHANICS_REGISTRY)) {
            for (const variant of Object.keys(variants)) add({...base, ...withActivatingParents({[family]: variant})});
        }
    }
    return [...seen.values()];
}
const SELECTIONS = selectionsToCheck();

/** Only what differs from the defaults, so labels stay readable. */
const labelOf = selection => Object.entries(completeSelection(selection))
    .filter(([f, v]) => v !== completeSelection({})[f])
    .map(([f, v]) => `${f}=${v}`).join(', ') || 'defaults';

for (const selection of SELECTIONS) {
    const label = labelOf(selection);
    test(`hidden parameters are inert under ${label}`, () => {
        const hidden = DYNAMIC_KEYS.filter(key => !isParamRelevant(key, selection));
        const baseline = runDigest(selection, SMALL_PARAMS);
        // All at once first. Only if that moves the run, one at a time to name the culprits.
        if (runDigest(selection, perturbed(SMALL_PARAMS, hidden)) === baseline) return;
        const leaks = hidden.filter(key => runDigest(selection, perturbed(SMALL_PARAMS, [key])) !== baseline);
        assert.fail(`hidden under {${label}}, yet they change the run: ${leaks.join(', ') || '(only jointly)'}. ` +
            `Add the variant that reads each one to its usedBy in src/core/params.js.`);
    });
}

/**
 * Parameters whose effect takes longer than a short, small run to reach the trajectory, and
 * the run that exhibits it. Each is a real dependency, not a stale tag.
 */
const EXHIBIT = {
    // Loyalty only bites once a better trade appears next to the one an agent already uses.
    tradeLoyaltyThreshold: {params: defaultParams(), ticks: 400},
    // Nearly every link carries something, so an idle link is rare in a short run.
    linkIdleTicks: {params: defaultParams(), ticks: 400},
    // Paid only on a managed trade whose inventor is alive. At the default
    // surplusToTradeFraction of 0, hierarchy starts only after the founder dies, so it never is.
    inventorPerpetualRoyalty: {params: {...defaultParams(), surplusToTradeFraction: 0.5}, ticks: 200},
};

test('every tagged parameter changes the run somewhere it is shown (no stale tags)', () => {
    const tagged = DYNAMIC_KEYS.filter(k => PARAM_SCHEMA[k].usedBy?.length > 0);
    const stale = [];
    for (const key of tagged) {
        const shownUnder = SELECTIONS.filter(sel => isParamRelevant(key, sel));
        assert.ok(shownUnder.length > 0, `${key} is relevant under none of the checked selections`);
        const {params, ticks} = EXHIBIT[key] ?? {params: SMALL_PARAMS, ticks: TICKS};
        const matters = shownUnder.some(sel =>
            runDigest(sel, params, ticks) !== runDigest(sel, perturbed(params, [key]), ticks));
        if (!matters) stale.push(key);
    }
    assert.deepEqual(stale, [], `shown by their tags, but perturbing them changes nothing`);
});

// ---- scenarios ----------------------------------------------------------------------------

// Only the grid: a scenario's `params` may be a verbatim saved config (hierarchy-depth-sweep's
// is), which legitimately carries every key. Sweeping a parameter that cannot matter, though,
// burns a whole grid axis of runs on identical trajectories.
test('scenarios sweep only parameters their own mechanics use', () => {
    const problems = [];
    for (const scenario of Object.values(SCENARIOS)) {
        const selection = {...scenario.mechanics, ...(scenario.terrain ? {terrain: scenario.terrain} : {})};
        for (const key of Object.keys(scenario.grid ?? {})) {
            if (PARAM_SCHEMA[key] && !isParamRelevant(key, selection)) problems.push(`${scenario.name}: ${key}`);
        }
    }
    assert.deepEqual(problems, [], `swept parameters inert under the scenario's own mechanics`);
});
