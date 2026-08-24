/**
 * Single-run execution: build a simulation from a scenario, attach probes, run, persist.
 *
 * Everything needed to reproduce a run is captured before it starts — resolved parameters,
 * mechanics selection, seed, and the git SHA with a dirty flag. A result whose provenance
 * says `code_dirty = 1` was produced by uncommitted code and should not be trusted in a
 * paper.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';
import {Simulation} from '../core/simulation.js';
import {resolveProbes} from '../probes/registry.js';
import {JsonlWriter} from './store/jsonl.js';
import {namespaced} from '../probes/probe.js';

/** Current commit and whether the tree is dirty. Null outside a git repo. */
export function gitProvenance() {
    try {
        const sha = execSync('git rev-parse HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
        const status = execSync('git status --porcelain', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
        return {sha, dirty: status.length > 0};
    } catch {
        return {sha: null, dirty: false};
    }
}

/** Deterministic, human-readable run identifier. */
export function makeRunId(scenario, fingerprint, seed) {
    return `${scenario}_${fingerprint}_s${seed}`;
}

/**
 * Execute one run.
 *
 * @param {Object} config
 * @param {string}  config.experiment    grouping label for the run database
 * @param {Object}  config.scenario      scenario definition (see src/scenarios/)
 * @param {Object} [config.params]       overrides applied on top of the scenario's params
 * @param {number} [config.seed]         overrides the scenario/param seed
 * @param {number} [config.ticks]
 * @param {number} [config.samplePeriod] ticks between timeseries samples
 * @param {string} [config.outputRoot]   directory root for JSONL streams
 * @param {RunStore} [config.store]      run database; omit to run without persistence
 * @param {boolean} [config.quiet]
 * @returns {Object} the run summary
 */
export function runOnce(config) {
    const {
        experiment = 'adhoc',
        scenario,
        store = null,
        outputRoot = 'results',
        quiet = false,
    } = config;

    if (!scenario) throw new Error('runOnce requires a scenario');

    const params = {...(scenario.params ?? {}), ...(config.params ?? {})};
    if (config.seed !== undefined) params.seed = config.seed;

    const ticks = config.ticks ?? scenario.ticks ?? 1000;
    const samplePeriod = config.samplePeriod ?? scenario.samplePeriod ?? 10;
    const probeNames = config.probes ?? scenario.probes ?? ['core'];

    const sim = new Simulation({
        params,
        mechanics: scenario.mechanics ?? {},
        terrain: scenario.terrain,
        strictParams: config.strictParams !== false,
    });

    const runId = makeRunId(scenario.name, sim.paramsFingerprint, sim.params.seed);
    const runDir = path.join(outputRoot, experiment, runId);
    const git = gitProvenance();
    const startedAt = new Date().toISOString();

    const probes = resolveProbes(probeNames);
    const jsonl = new JsonlWriter(runDir);
    const emit = (stream, row) => jsonl.write(stream, {runId, ...row});

    for (const probe of probes) probe.attach(sim, emit);

    if (store) {
        store.openRun({
            runId, experiment, scenario: scenario.name, seed: sim.params.seed, ticks,
            params: sim.params, mechanics: sim.mechanics.names,
            paramsFingerprint: sim.paramsFingerprint, probes: probeNames,
            gitSha: git.sha, codeDirty: git.dirty, startedAt, outputDir: runDir,
        });
    }

    // The fully-resolved configuration, beside the data it produced.
    fs.writeFileSync(path.join(runDir, 'config.json'), JSON.stringify({
        runId, experiment, scenario: scenario.name, ticks, samplePeriod, probes: probeNames,
        params: sim.params, mechanics: sim.mechanics.names, git, startedAt,
    }, null, 2));

    const t0 = Date.now();
    let status = 'ok';
    let error = null;
    let summary = {};

    try {
        sim.run(ticks, {
            onTick: s => {
                if (s.tick % samplePeriod !== 0) return;
                let row = {};
                for (const probe of probes) {
                    const sampled = probe.sample(s);
                    if (sampled) Object.assign(row, namespaced(probe.name, sampled));
                }
                if (Object.keys(row).length > 0) {
                    jsonl.write('timeseries', {runId, tick: s.tick, ...row});
                }
            },
        });

        for (const probe of probes) {
            Object.assign(summary, namespaced(probe.name, probe.summary(sim)));
        }
    } catch (err) {
        status = 'failed';
        error = `${err.name}: ${err.message}`;
        if (!quiet) console.error(`  run ${runId} FAILED at tick ${sim.tick}: ${error}`);
    }

    const wallMs = Date.now() - t0;
    const finalStateHash = sim.hashState();

    // A probe that threw would otherwise fail silently and produce a gap in the data.
    if (sim.events.errors.length > 0) {
        status = status === 'ok' ? 'probe-error' : status;
        error = error ?? `probe threw: ${sim.events.errors[0].error.message}`;
    }

    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({
        runId, status, error, wallMs, finalStateHash,
        ticksCompleted: sim.tick, streams: jsonl.stats(), summary,
    }, null, 2));

    jsonl.close();
    if (store) store.closeRun(runId, {status, summary, error, wallMs, finalStateHash});

    if (!quiet) {
        console.log(
            `  ${runId}  ${status}  ${sim.tick} ticks  ${(wallMs / 1000).toFixed(1)}s  ` +
            `pop=${sim.world.population}  maxLevel=${summary['core.maxLevelReached'] ?? '?'}`
        );
    }

    return {runId, status, error, wallMs, summary, sim};
}
