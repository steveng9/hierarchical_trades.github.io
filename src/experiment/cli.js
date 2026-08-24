#!/usr/bin/env node
/**
 * Experiment CLI.
 *
 *   node src/experiment/cli.js scenarios
 *   node src/experiment/cli.js mechanics
 *   node src/experiment/cli.js run   --scenario g4-succession --seed 7 --ticks 2000
 *   node src/experiment/cli.js sweep --scenario g1-value-accounting --seeds 1-10
 *   node src/experiment/cli.js query --experiment g1-value-accounting --metric core.finalPopulation
 *
 * Results land in `results/<experiment>/`: one SQLite database of run records and scalar
 * metrics, plus a directory per run holding config, summary, and JSONL streams.
 */
import path from 'node:path';
import {parseArgs} from 'node:util';
import {SCENARIOS, getScenario, listScenarios} from '../scenarios/index.js';
import {describeMechanics} from '../mechanics/registry.js';
import {PROBE_REGISTRY} from '../probes/registry.js';
import {RunStore} from './store/sqlite.js';
import {runOnce} from './runner.js';
import {runSweep} from './sweep.js';

const USAGE = `
Hierarchical Trades — experiment runner

  scenarios                       list scenarios and their status
  mechanics                       list swappable mechanics and their variants
  run    --scenario NAME          run one simulation
  sweep  --scenario NAME          run the scenario's parameter grid across seeds
  query  --experiment NAME        summarise a stored metric across runs

Options
  --scenario NAME     scenario to run
  --experiment NAME   experiment label (defaults to the scenario name)
  --seed N            single-run seed
  --seeds A-B | A,B   sweep seeds (range or list)
  --ticks N           override the scenario's run length
  --sample N          ticks between timeseries samples
  --terrain NAME      override the terrain generator
  --out DIR           results root (default: results)
  --metric KEY        metric for 'query'
  --no-resume         re-run cells that already completed
  --quiet
`;

const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
        scenario:   {type: 'string'},
        experiment: {type: 'string'},
        seed:       {type: 'string'},
        seeds:      {type: 'string'},
        ticks:      {type: 'string'},
        sample:     {type: 'string'},
        terrain:    {type: 'string'},
        out:        {type: 'string', default: 'results'},
        metric:     {type: 'string'},
        'no-resume':{type: 'boolean', default: false},
        quiet:      {type: 'boolean', default: false},
        help:       {type: 'boolean', default: false},
    },
});

/** "1-10" or "1,3,5" or "7" -> number[] */
function parseSeeds(spec) {
    if (!spec) return null;
    if (spec.includes('-')) {
        const [lo, hi] = spec.split('-').map(Number);
        return Array.from({length: hi - lo + 1}, (_, i) => lo + i);
    }
    return spec.split(',').map(Number);
}

function cmdScenarios() {
    console.log('\nScenarios:\n');
    for (const s of listScenarios()) {
        const status = s.blocked ? 'BLOCKED' : 'ready';
        console.log(`  ${s.name.padEnd(30)} [group ${s.group}] ${status}`);
        console.log(`    ${s.description}`);
        if (s.blocked) console.log(`    ! ${s.blocked}`);
        if (s.grid) {
            const cells = Object.values(s.grid).reduce((a, v) => a * v.length, 1);
            const seeds = (s.seeds ?? []).length || 5;
            console.log(`    grid: ${JSON.stringify(s.grid)} -> ${cells} cell(s) x ${seeds} seed(s) = ${cells * seeds} runs`);
        }
        console.log();
    }
}

function cmdMechanics() {
    console.log('\nSwappable mechanics:\n');
    for (const [mechanic, info] of Object.entries(describeMechanics())) {
        console.log(`  ${mechanic.padEnd(14)} default: ${info.default}`);
        console.log(`  ${''.padEnd(14)} variants: ${info.variants.join(', ')}\n`);
    }
    console.log('Probes:\n  ' + Object.keys(PROBE_REGISTRY).join(', ') + '\n');
}

function storeFor(experiment) {
    return new RunStore(path.join(values.out, experiment, 'experiment.db'));
}

function cmdRun() {
    const scenario = getScenario(values.scenario);
    const experiment = values.experiment ?? scenario.name;
    const store = storeFor(experiment);
    try {
        const result = runOnce({
            experiment,
            scenario: values.terrain ? {...scenario, terrain: values.terrain} : scenario,
            seed: values.seed !== undefined ? Number(values.seed) : undefined,
            ticks: values.ticks ? Number(values.ticks) : undefined,
            samplePeriod: values.sample ? Number(values.sample) : undefined,
            outputRoot: values.out,
            store,
            quiet: values.quiet,
        });
        if (!values.quiet) {
            console.log('\nSummary:');
            for (const [k, v] of Object.entries(result.summary)) {
                console.log(`  ${k.padEnd(42)} ${typeof v === 'number' ? v.toFixed(4) : v}`);
            }
        }
        process.exitCode = result.status === 'ok' ? 0 : 1;
    } finally {
        store.close();
    }
}

function cmdSweep() {
    const scenario = getScenario(values.scenario);
    const experiment = values.experiment ?? scenario.name;
    const store = storeFor(experiment);
    try {
        const result = runSweep({
            experiment,
            scenario: values.terrain ? {...scenario, terrain: values.terrain} : scenario,
            grid: scenario.grid ?? {},
            seeds: parseSeeds(values.seeds) ?? scenario.seeds ?? [1, 2, 3, 4, 5],
            ticks: values.ticks ? Number(values.ticks) : undefined,
            samplePeriod: values.sample ? Number(values.sample) : undefined,
            outputRoot: values.out,
            store,
            resume: !values['no-resume'],
            quiet: values.quiet,
        });
        process.exitCode = result.failed > 0 ? 1 : 0;
    } finally {
        store.close();
    }
}

function cmdQuery() {
    const experiment = values.experiment;
    if (!experiment) throw new Error('query requires --experiment');
    const store = storeFor(experiment);
    try {
        if (!values.metric) {
            const runs = store.listRuns(experiment);
            console.log(`\n${runs.length} run(s) in "${experiment}":\n`);
            for (const r of runs) {
                console.log(`  ${r.run_id.padEnd(46)} ${r.status.padEnd(12)} seed=${String(r.seed).padEnd(4)} ${r.wall_ms ?? '?'}ms`);
            }
            console.log();
            return;
        }
        const rows = store.metric(experiment, values.metric);
        console.log(`\n${values.metric} across ${rows.length} run(s):\n`);
        // Group by the swept parameters so cells are comparable at a glance.
        const groups = new Map();
        for (const row of rows) {
            const params = JSON.parse(row.params_json);
            const key = JSON.stringify(
                Object.fromEntries(Object.entries(params).filter(([k]) =>
                    ['maxTradeLevel', 'surplusToTradeFraction', 'undulation_cutuff',
                     'initialHumans', 'social_reach_multiplier', 'numResources'].includes(k)))
            );
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row.value);
        }
        for (const [key, xs] of groups) {
            const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
            const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
            console.log(`  ${key}`);
            console.log(`    n=${xs.length}  mean=${mean.toFixed(4)}  sd=${sd.toFixed(4)}\n`);
        }
    } finally {
        store.close();
    }
}

const command = positionals[0];
if (values.help || !command) {
    console.log(USAGE);
} else {
    const commands = {scenarios: cmdScenarios, mechanics: cmdMechanics, run: cmdRun, sweep: cmdSweep, query: cmdQuery};
    const fn = commands[command];
    if (!fn) {
        console.error(`Unknown command "${command}".`);
        console.log(USAGE);
        process.exitCode = 2;
    } else {
        fn();
    }
}
