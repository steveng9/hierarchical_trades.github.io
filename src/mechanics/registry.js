/**
 * Mechanics registry: the seam between the kernel and the swappable rules.
 *
 * A scenario names the implementation it wants for each mechanic; the kernel calls the
 * resolved objects without knowing which was chosen. Adding a rule variant means adding a
 * named entry in the relevant module — never editing the kernel.
 *
 * Every default here reproduces the pre-refactor behaviour exactly, so the golden
 * trajectories hold. Selecting anything else is an explicit, documented departure.
 */
import {METABOLISM} from './metabolism.js';
import {VALUATION} from './valuation.js';
import {PRICING} from './pricing.js';
import {REPRODUCTION} from './reproduction.js';
import {LIFECYCLE} from './lifecycle.js';
import {TERRAIN_GENERATORS} from './terrain.js';
import {TRADE_SELECTION} from './tradeSelection.js';
import {POPULATION} from './population.js';

export const MECHANICS_REGISTRY = {
    metabolism:   METABOLISM,
    valuation:    VALUATION,
    pricing:      PRICING,
    reproduction: REPRODUCTION,
    lifecycle:    LIFECYCLE,
    terrain:        TERRAIN_GENERATORS,
    tradeSelection: TRADE_SELECTION,
    population:     POPULATION,
};

/** The historical rule set. Any deviation should be justified in the scenario file. */
export const DEFAULT_MECHANICS = Object.freeze({
    metabolism:   'classic',
    valuation:    'needOverHoldings',
    pricing:      'dispersionSpread',
    reproduction: 'asexualSplit',
    lifecycle:    'idleWindow',
    terrain:        'wavy',
    tradeSelection: 'invokeAll',
    population:     'uniform',
});

/**
 * Resolve a selection of mechanic names into callable implementations.
 *
 * @param {Object<string,string>} selection  partial map of mechanic -> variant name
 * @returns {{names: Object<string,string>} & Object<string,*>}
 */
export function resolveMechanics(selection = {}) {
    const names = {...DEFAULT_MECHANICS, ...selection};
    const resolved = {names};

    for (const [mechanic, variant] of Object.entries(names)) {
        const family = MECHANICS_REGISTRY[mechanic];
        if (!family) {
            throw new Error(
                `Unknown mechanic "${mechanic}". Available: ${Object.keys(MECHANICS_REGISTRY).join(', ')}`
            );
        }
        const impl = family[variant];
        if (!impl) {
            throw new Error(
                `Unknown ${mechanic} variant "${variant}". Available: ${Object.keys(family).join(', ')}`
            );
        }
        resolved[mechanic] = impl;
    }
    return resolved;
}

/** Every mechanic and its variants. Used for documentation and sweep generation. */
export function describeMechanics() {
    const out = {};
    for (const [mechanic, family] of Object.entries(MECHANICS_REGISTRY)) {
        out[mechanic] = {
            variants: Object.keys(family),
            default: DEFAULT_MECHANICS[mechanic],
        };
    }
    return out;
}
