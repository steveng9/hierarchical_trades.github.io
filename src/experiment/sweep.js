/**
 * Parameter sweeps: a cartesian grid crossed with replicate seeds.
 *
 * Replicates are not optional. A single run of a stochastic agent-based model is an
 * anecdote; the unit of evidence is the distribution across seeds, so `seeds` defaults to a
 * range rather than a single value.
 *
 * Completed cells are skipped by default, so an interrupted sweep resumes rather than
 * restarting.
 *
 * Parallel mode dispatches cells to worker threads (one simulation per thread). The SQLite
 * store uses WAL mode, so concurrent writers don't block each other.
 */
import {Worker} from 'node:worker_threads';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runOnce} from './runner.js';
import {resolveParams, paramsFingerprint} from '../core/params.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, 'worker.js');

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
 * @param {number}  [config.concurrency=1]  worker threads for parallel execution
 * @returns {{cells:number, ran:number, skipped:number, failed:number, results:Array}}
 */
export function runSweep(config) {
    const {concurrency = 1} = config;
    if (concurrency > 1) return runSweepParallel(config);
    return runSweepSequential(config);
}

function runSweepSequential(config) {
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

async function runSweepParallel(config) {
    const {
        experiment,
        scenario,
        grid = {},
        seeds = [1, 2, 3, 4, 5],
        store = null,
        resume = true,
        quiet = false,
        concurrency = 4,
        ...runConfig
    } = config;

    const combos = expandGrid(grid);
    const total = combos.length * seeds.length;

    if (!quiet) {
        console.log(`\nSweep "${experiment}" — scenario "${scenario.name}"`);
        console.log(`${combos.length} cell(s) x ${seeds.length} seed(s) = ${total} runs  [${concurrency} workers]\n`);
    }

    const tasks = [];
    let skipped = 0;

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

            tasks.push({
                ...runConfig,
                experiment,
                scenario,
                params,
                seed,
                quiet,
            });
        }
    }

    if (!quiet && skipped > 0) {
        console.log(`  ${skipped} already complete, ${tasks.length} to run\n`);
    }

    // The main thread's store has already created the DB and schema. Workers open
    // their own connections (WAL + busy_timeout handles contention). Close the main
    // connection so it doesn't hold a lock while workers write.
    const dbPath = store?.path ?? null;
    if (store) store.close();

    const results = [];
    let ran = 0, failed = 0;
    let taskIndex = 0;

    function launchNext() {
        if (taskIndex >= tasks.length) return null;
        const task = tasks[taskIndex++];
        return new Promise((resolve) => {
            const worker = new Worker(WORKER_PATH, {
                workerData: {task, dbPath},
            });
            worker.on('message', (msg) => {
                ran++;
                if (msg.status === 'error' || msg.runStatus !== 'ok') failed++;
                if (!quiet) {
                    if (msg.status === 'done') {
                        const maxLevel = task.params.maxTradeLevel;
                        const label = maxLevel === null ? 'null' : String(maxLevel);
                        console.log(
                            `  ${msg.runId}  ${msg.runStatus}  ${(msg.wallMs / 1000).toFixed(1)}s` +
                            `  pop=${msg.summary?.['core.finalPopulation'] ?? '?'}` +
                            `  maxLevel=${label}` +
                            `  depth=${msg.summary?.['core.maxLevelReached'] ?? '?'}`
                        );
                    } else {
                        console.log(`  WORKER ERROR: ${msg.error}`);
                    }
                }
                results.push({combo: task.params, seed: task.seed, ...msg});
                resolve();
            });
            worker.on('error', (err) => {
                ran++;
                failed++;
                if (!quiet) console.log(`  WORKER CRASH: ${err.message}`);
                results.push({combo: task.params, seed: task.seed, status: 'error', error: err.message});
                resolve();
            });
        });
    }

    // Fill the pool and keep it full until all tasks are dispatched.
    const pool = [];
    for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
        pool.push(launchNext());
    }

    while (pool.length > 0) {
        const settled = await Promise.race(pool.map((p, i) => p.then(() => i)));
        pool.splice(settled, 1);
        const next = launchNext();
        if (next) pool.push(next);
    }

    if (!quiet) {
        console.log(`\nDone: ${ran} ran, ${skipped} skipped (already complete), ${failed} failed.\n`);
    }
    return {cells: combos.length, ran, skipped, failed, results};
}
