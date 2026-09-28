/**
 * Mechanics registry: the seam between the kernel and the swappable rules.
 *
 * A scenario names the implementation it wants for each mechanic; the kernel calls the
 * resolved objects without knowing which was chosen. Adding a rule variant means adding a
 * named entry in the relevant module — never editing the kernel — plus an <option> in its
 * index.html selector, and the variant's name in the `usedBy` tag of every parameter it
 * reads (src/core/params.js). test/relevance.test.js fails until all three are done.
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
import {MATCHING} from './matching.js';
import {EXCHANGE} from './exchange.js';
import {LINK_FORMATION} from './linkFormation.js';

export const MECHANICS_REGISTRY = {
    metabolism:   METABOLISM,
    valuation:    VALUATION,
    pricing:      PRICING,
    reproduction: REPRODUCTION,
    lifecycle:    LIFECYCLE,
    terrain:        TERRAIN_GENERATORS,
    tradeSelection: TRADE_SELECTION,
    population:     POPULATION,
    matching:       MATCHING,
    exchange:       EXCHANGE,
    linkFormation:  LINK_FORMATION,
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
    matching:       'frictionless',
    exchange:       'postedTrades',
    linkFormation:  'localProbability',   // read only under exchange: 'pairwise'
});

/**
 * When a family's choice matters at all. A family missing here is always active. Otherwise
 * it is active when any listed clause holds, and a clause holds when every family it names
 * is active and set to one of the listed variants (see `src/mechanics/relevance.js`).
 *
 * Only families that the kernel reaches through one exchange engine belong here: the
 * posted-trades families are called only from `TradeManager`/`Trade`, and link formation
 * only from `PairwiseExchange`. The control panel hides an inactive family's selector, and
 * every parameter tagged with it.
 *
 * Adding a family: add it here if it is reached through only some variants of another.
 */
export const FAMILY_REQUIRES = Object.freeze({
    pricing:        [{exchange: ['postedTrades']}],
    tradeSelection: [{exchange: ['postedTrades']}],
    lifecycle:      [{exchange: ['postedTrades']}],
    matching:       [{exchange: ['postedTrades']}],
    linkFormation:  [{exchange: ['pairwise']}],
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
