/**
 * Scenario registry.
 *
 * A scenario is a declarative bundle: parameter overrides, mechanic selection, probes, run
 * length, and (optionally) a sweep grid with replicate seeds. Exploring a research direction
 * means writing one of these — never editing the kernel.
 *
 * Fields:
 *   name, group, description
 *   params, mechanics, terrain, probes, ticks, samplePeriod
 *   grid            {param: [values]} for sweeps
 *   seeds           replicate seeds
 *   primaryMetrics  the columns this scenario exists to produce
 *   blocked         non-null if the scenario needs unimplemented mechanics
 */
import {baseline} from './baseline.js';
import {valueAccounting} from './g1-value-accounting.js';
import {enforcement} from './g2-enforcement.js';
import {geography} from './g3-geography.js';
import {succession, successionPolicyControl, depthPhaseDiagram} from './g4-succession.js';
import {money} from './g5-money.js';
import {evolution} from './g6-evolution.js';
import {hierarchyDepthSweep} from './hierarchy-depth-sweep.js';

export const SCENARIOS = {
    [baseline.name]:                baseline,
    [valueAccounting.name]:         valueAccounting,
    [enforcement.name]:             enforcement,
    [geography.name]:               geography,
    [succession.name]:              succession,
    [successionPolicyControl.name]: successionPolicyControl,
    [depthPhaseDiagram.name]:       depthPhaseDiagram,
    [money.name]:                   money,
    [evolution.name]:               evolution,
    [hierarchyDepthSweep.name]:     hierarchyDepthSweep,
};

export function getScenario(name) {
    const scenario = SCENARIOS[name];
    if (!scenario) {
        throw new Error(`Unknown scenario "${name}". Available:\n  ${Object.keys(SCENARIOS).join('\n  ')}`);
    }
    if (scenario.blocked) {
        throw new Error(`Scenario "${name}" is blocked: ${scenario.blocked}`);
    }
    return scenario;
}

export function listScenarios() {
    return Object.values(SCENARIOS)
        .sort((a, b) => a.group - b.group || a.name.localeCompare(b.name));
}
