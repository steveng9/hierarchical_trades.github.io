/**
 * Relevance: which parameters, and which mechanic families, matter under a mechanic selection.
 *
 * The control panel uses this to show only the controls that can change the next run. The
 * tests use it to prove that every hidden parameter really changes nothing
 * (test/relevance.test.js).
 *
 * ## The one rule
 *
 * Relevance is declared as `usedBy` on a parameter (`PARAM_SCHEMA`) and as `FAMILY_REQUIRES`
 * on a family (registry.js), and both use the same form: a list of clauses, satisfied when ANY
 * clause holds. A clause maps families to variant lists and holds when EVERY family it names is
 * itself active and set to one of the listed variants.
 *
 *   usedBy absent                         always relevant (the kernel reads it on every path)
 *   usedBy: []                            never relevant (declared, but nothing reads it)
 *   usedBy: [{matching: ['distanceFriction']}]
 *                                         only when matching is active (i.e. posted trades)
 *                                         AND set to distanceFriction
 *   usedBy: [{exchange: ['postedTrades']}, {reproduction: ['sexualBlend']}]
 *                                         under posted trades, OR under sexual reproduction
 *
 * Because a clause requires its families to be active, a tag names only the family that
 * actually reads the parameter. The gating above it (e.g. matching exists only under posted
 * trades) is inherited from `FAMILY_REQUIRES`, never repeated.
 *
 * ## Maintenance
 *
 * - New parameter: tag it with the variants whose code reads it, or leave it untagged if the
 *   kernel reads it on every path.
 * - New variant: add it to the `usedBy` lists of every parameter it reads. Positive lists make
 *   this fail safe: an unlisted variant hides the parameter, and the perturbation test fails
 *   if the parameter nonetheless changes that variant's runs.
 * - New family: register it, and add it to `FAMILY_REQUIRES` if it is reached through only
 *   some variants of another family.
 */
import {PARAM_SCHEMA} from '../core/params.js';
import {DEFAULT_MECHANICS, FAMILY_REQUIRES} from './registry.js';

/** @typedef {Object<string, string[]>} Clause  family -> variants */

/** Complete a partial selection with the defaults, as `resolveMechanics` does. */
export function completeSelection(selection = {}) {
    return {...DEFAULT_MECHANICS, ...selection};
}

/**
 * @param {Clause[]|undefined} clauses
 * @param {Object<string,string>} names  a complete selection
 */
function anyClauseHolds(clauses, names, seen) {
    if (clauses === undefined) return true;
    return clauses.some(clause => Object.entries(clause).every(
        ([family, variants]) => familyActive(family, names, seen) && variants.includes(names[family])
    ));
}

function familyActive(family, names, seen) {
    if (seen.has(family)) throw new Error(`FAMILY_REQUIRES has a cycle through "${family}"`);
    const next = new Set(seen).add(family);
    return anyClauseHolds(FAMILY_REQUIRES[family], names, next);
}

/** Whether `family`'s choice can affect a run under `selection`. */
export function isFamilyActive(family, selection) {
    return familyActive(family, completeSelection(selection), new Set());
}

/** Whether parameter `key` can affect a run under `selection`. Unknown keys throw. */
export function isParamRelevant(key, selection) {
    const spec = PARAM_SCHEMA[key];
    if (!spec) throw new Error(`Unknown parameter "${key}"`);
    return anyClauseHolds(spec.usedBy, completeSelection(selection), new Set());
}

/** Every parameter key relevant under `selection`, in schema order. */
export function relevantParams(selection) {
    return Object.keys(PARAM_SCHEMA).filter(key => isParamRelevant(key, selection));
}

/**
 * Extend `selection` with the parent choices that make every family it names active, using
 * each family's first `FAMILY_REQUIRES` clause. `{linkFormation: 'parentNearest'}` becomes
 * `{linkFormation: 'parentNearest', exchange: 'pairwise'}`. Throws if an explicit choice in
 * `selection` rules that out.
 */
export function withActivatingParents(selection) {
    const out = {...selection};
    const pending = Object.keys(out);
    while (pending.length > 0) {
        const family = pending.pop();
        if (isFamilyActive(family, out)) continue;
        for (const [parent, variants] of Object.entries(FAMILY_REQUIRES[family][0])) {
            if (parent in selection && !variants.includes(selection[parent])) {
                throw new Error(`"${family}" is inactive under ${parent}: '${selection[parent]}'`);
            }
            out[parent] = variants[0];
            pending.push(parent);
        }
    }
    return out;
}

/**
 * Every family and variant a set of clauses mentions, for validating tags against the
 * registry. Returns [family, variant] pairs.
 */
export function mentionedVariants(clauses = []) {
    return clauses.flatMap(clause =>
        Object.entries(clause).flatMap(([family, variants]) => variants.map(v => [family, v])));
}
