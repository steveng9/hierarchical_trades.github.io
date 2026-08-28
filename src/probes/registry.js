/**
 * Probe registry. Scenarios name the probes they need; the runner instantiates them.
 */
import {CoreProbe} from './core.js';
import {TradeLifecycleProbe} from './tradelifecycle.js';
import {ValueLedgerProbe} from './valueledger.js';
import {HierarchyProbe} from './hierarchy.js';
import {TraitProbe} from './traits.js';
import {MoneyProbe} from './money.js';
import {SpatialProbe} from './spatial.js';

export const PROBE_REGISTRY = {
    core:      CoreProbe,
    lifecycle: TradeLifecycleProbe,
    value:     ValueLedgerProbe,
    hierarchy: HierarchyProbe,
    traits:    TraitProbe,
    money:     MoneyProbe,
    spatial:   SpatialProbe,
};

/** @param {string[]} names @returns {import('./probe.js').Probe[]} */
export function resolveProbes(names = ['core']) {
    return names.map(name => {
        const Ctor = PROBE_REGISTRY[name];
        if (!Ctor) {
            throw new Error(`Unknown probe "${name}". Available: ${Object.keys(PROBE_REGISTRY).join(', ')}`);
        }
        return new Ctor();
    });
}
