/**
 * Parameter sweeps: a cartesian grid crossed with replicate seeds.
 *
 * Replicates are not optional. A single run of a stochastic agent-based model is an
 * anecdote; the unit of evidence is the distribution across seeds, so `seeds` defaults to a
 * range rather than a single value.
 *
 * Completed cells are skipped by default, so an interrupted sweep resumes rather than
 * restarting.
 */
import {runOnce} from './runner.js';
import {resolveParams, paramsFingerprint} from '../core/params.js';

/** Cartesian product of {key: [values]} into an array of override objects. */
export function expandGrid(grid) {
    let combos = [{}];
    for (const [key, values] of Object.entries(grid)) {
        const next = [];
        for (const combo of combos) {
            for (const value of values) next.push({...combo, [key]: value});
        }
        combos = next;
    }
    return combos;
}

/**
 * @param {Object} config
 * @param {string}   config.experiment
 * @param {Object}   config.scenario
 * @param {Object}  [config.grid]     {paramName: [values]}
 * @param {number[]}[config.seeds]    replicate seeds
 * @param {boolean} [config.resume=true]
 * @returns {{cells:number, ran:number, skipped:number, failed:number, results:Array}}
 */
export function runSweep(config) {
    const {
        experiment,
        scenario,
        grid = {},
        seeds = [1, 2, 3, 4, 5],
        store = null,
        resume = true,
        quiet = false,
        ...runConfig
    } = config;

    const combos = expandGrid(grid);
    const total = combos.length * seeds.length;
    const results = [];
    let ran = 0, skipped = 0, failed = 0;

    if (!quiet) {
        console.log(`\nSweep "${experiment}" — scenario "${scenario.name}"`);
        console.log(`${combos.length} cell(s) x ${seeds.length} seed(s) = ${total} runs\n`);
    }

    for (const combo of combos) {
        for (const seed of seeds) {
            const params = {...(scenario.params ?? {}), ...combo, seed};

            if (resume && store) {
                const fingerprint = paramsFingerprint(resolveParams(params, {strict: false}));
                if (store.hasCompleted(experiment, scenario.name, fingerprint, seed)) {
                    skipped++;
                    continue;
                }
            }

            const result = runOnce({
                ...runConfig, experiment, scenario, params, seed, store, quiet,
            });
            results.push({combo, seed, ...result});
            ran++;
            if (result.status !== 'ok') failed++;
        }
    }

    if (!quiet) {
        console.log(`\nDone: ${ran} ran, ${skipped} skipped (already complete), ${failed} failed.\n`);
    }
    return {cells: combos.length, ran, skipped, failed, results};
}
