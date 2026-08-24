import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RunStore} from '../src/experiment/store/sqlite.js';
import {JsonlWriter} from '../src/experiment/store/jsonl.js';
import {runOnce, makeRunId} from '../src/experiment/runner.js';
import {runSweep, expandGrid} from '../src/experiment/sweep.js';
import {SCENARIOS, getScenario, listScenarios} from '../src/scenarios/index.js';

function tmpdir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'htrades-test-'));
}

test('expandGrid produces the cartesian product', () => {
    const combos = expandGrid({a: [1, 2], b: ['x', 'y', 'z']});
    assert.equal(combos.length, 6);
    assert.deepEqual(combos[0], {a: 1, b: 'x'});
});

test('expandGrid of an empty grid is a single empty cell', () => {
    assert.deepEqual(expandGrid({}), [{}]);
});

test('JSONL writer appends valid line-delimited JSON', () => {
    const dir = tmpdir();
    const w = new JsonlWriter(dir);
    w.write('rows', {a: 1});
    w.write('rows', {a: 2});
    w.close();

    const lines = fs.readFileSync(path.join(dir, 'rows.jsonl'), 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map(l => JSON.parse(l)), [{a: 1}, {a: 2}]);
});

test('run store round-trips a run and its metrics', () => {
    const dir = tmpdir();
    const store = new RunStore(path.join(dir, 'e.db'));
    store.openRun({
        runId: 'r1', experiment: 'exp', scenario: 'baseline', seed: 1, ticks: 10,
        params: {seed: 1}, mechanics: {}, paramsFingerprint: 'abcd1234', probes: ['core'],
        startedAt: new Date().toISOString(),
    });
    store.closeRun('r1', {status: 'ok', summary: {'core.finalPopulation': 42, 'core.hash': 'notanumber'}});

    const runs = store.listRuns('exp');
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'ok');

    const metric = store.metric('exp', 'core.finalPopulation');
    assert.equal(metric.length, 1);
    assert.equal(metric[0].value, 42);

    // Non-numeric summary values are skipped rather than stored as NaN.
    assert.equal(store.metric('exp', 'core.hash').length, 0);
    assert.ok(store.hasCompleted('exp', 'baseline', 'abcd1234', 1));
    assert.ok(!store.hasCompleted('exp', 'baseline', 'abcd1234', 2));
    store.close();
});

test('runOnce writes config, summary, and streams', () => {
    const dir = tmpdir();
    const store = new RunStore(path.join(dir, 'e.db'));
    const result = runOnce({
        experiment: 'smoke', scenario: SCENARIOS.baseline, seed: 3, ticks: 60,
        samplePeriod: 20, probes: ['core', 'lifecycle'], outputRoot: dir, store, quiet: true,
    });
    store.close();

    assert.equal(result.status, 'ok');
    const runDir = path.join(dir, 'smoke', result.runId);
    assert.ok(fs.existsSync(path.join(runDir, 'config.json')));
    assert.ok(fs.existsSync(path.join(runDir, 'summary.json')));
    assert.ok(fs.existsSync(path.join(runDir, 'timeseries.jsonl')));

    const config = JSON.parse(fs.readFileSync(path.join(runDir, 'config.json'), 'utf8'));
    assert.equal(config.params.seed, 3);
    assert.ok(config.params.surplus_multiplier !== undefined, 'full resolved params must be recorded');
});

test('run ids are stable for the same configuration', () => {
    assert.equal(makeRunId('s', 'ff00', 7), makeRunId('s', 'ff00', 7));
    assert.notEqual(makeRunId('s', 'ff00', 7), makeRunId('s', 'ff00', 8));
});

test('sweep runs every cell and resumes on a second pass', () => {
    const dir = tmpdir();
    const store = new RunStore(path.join(dir, 'e.db'));
    const config = {
        experiment: 'sweepsmoke', scenario: SCENARIOS.baseline,
        grid: {maxTradeLevel: [0, 1]}, seeds: [1, 2],
        ticks: 40, samplePeriod: 20, outputRoot: dir, store, quiet: true,
    };
    const first = runSweep(config);
    assert.equal(first.ran, 4);
    assert.equal(first.failed, 0);

    const second = runSweep(config);
    assert.equal(second.ran, 0, 'completed cells should be skipped');
    assert.equal(second.skipped, 4);
    store.close();
});

test('blocked scenarios refuse to run', () => {
    assert.throws(() => getScenario('g2-enforcement'), /blocked/i);
});

test('every unblocked scenario is runnable', () => {
    const dir = tmpdir();
    for (const scenario of listScenarios()) {
        if (scenario.blocked) continue;
        const result = runOnce({
            experiment: 'scenariosmoke', scenario, ticks: 30, samplePeriod: 15,
            outputRoot: dir, quiet: true,
        });
        assert.equal(result.status, 'ok', `${scenario.name} failed: ${result.error}`);
    }
});
