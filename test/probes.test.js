import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/core/simulation.js';
import {PROBE_REGISTRY, resolveProbes} from '../src/probes/registry.js';

const small = {seed: 12345, initialHumans: 150, forestwidth: 500, forestheight: 400};

test('unknown probe throws', () => {
    assert.throws(() => resolveProbes(['nope']), /Unknown probe/);
});

test('every probe attaches, samples, and summarises without throwing', () => {
    for (const name of Object.keys(PROBE_REGISTRY)) {
        const sim = new Simulation({params: small});
        const [probe] = resolveProbes([name]);
        const rows = [];
        probe.attach(sim, (stream, row) => rows.push({stream, row}));
        sim.run(150, {onTick: s => { if (s.tick % 25 === 0) probe.sample(s); }});
        const summary = probe.summary(sim);
        assert.equal(typeof summary, 'object', `${name} summary is not an object`);
        for (const [k, v] of Object.entries(summary)) {
            assert.ok(v === null || typeof v === 'number' || typeof v === 'string',
                `${name}.${k} is not a primitive: ${typeof v}`);
        }
    }
});

test('probes never throw into the event bus', () => {
    const sim = new Simulation({params: small});
    const probes = resolveProbes(Object.keys(PROBE_REGISTRY));
    for (const p of probes) p.attach(sim, () => {});
    sim.run(200, {onTick: s => { for (const p of probes) p.sample(s); }});
    assert.deepEqual(sim.events.errors, []);
});

test('core probe reports zero conservation drift', () => {
    const sim = new Simulation({params: small});
    const [core] = resolveProbes(['core']);
    sim.run(200);
    const summary = core.summary(sim);
    assert.ok(summary.maxConservationDrift < 1e-6, `drift ${summary.maxConservationDrift}`);
});

test('lifecycle probe records retired trades with lifespans', () => {
    const sim = new Simulation({params: {seed: 12345}, mechanics: {lifecycle: 'idleWindow'}});
    const [probe] = resolveProbes(['lifecycle']);
    const emitted = [];
    probe.attach(sim, (stream, row) => emitted.push(row));
    sim.run(400);

    assert.ok(emitted.length > 0, 'expected retired trades');
    for (const rec of emitted) {
        assert.ok(Number.isFinite(rec.lifespan) && rec.lifespan >= 0);
        assert.ok(rec.level >= 1);
        assert.ok(rec.deathTick >= rec.birthTick);
    }
    const summary = probe.summary(sim);
    assert.ok(summary.tradesObserved >= emitted.length);
});

test('hierarchy probe depth agrees with the trade manager', () => {
    const sim = new Simulation({params: {seed: 12345}}).run(400);
    const [probe] = resolveProbes(['hierarchy']);
    assert.equal(probe.sample(sim).maxDepth, sim.world.trademanager.maxActiveLevel());
});

test('value probe fractions are well-formed', () => {
    const sim = new Simulation({params: small}).run(300);
    const [probe] = resolveProbes(['value']);
    const row = probe.sample(sim);
    for (const key of ['fracLaborers', 'fracManagers', 'fracInventors', 'fracPooled']) {
        assert.ok(row[key] >= 0 && row[key] <= 1, `${key} out of [0,1]: ${row[key]}`);
    }
    assert.ok(row.giniEnergy >= 0 && row.giniEnergy <= 1);
});

test('money probe volume shares sum to about one when volume exists', () => {
    const sim = new Simulation({params: {seed: 12345}}).run(400);
    const [probe] = resolveProbes(['money']);
    const row = probe.sample(sim);
    const total = [0, 1, 2].reduce((a, r) => a + (row[`r${r}_volumeShare`] ?? 0), 0);
    assert.ok(Math.abs(total - 1) < 1e-6 || total === 0, `shares summed to ${total}`);
});

test('trait probe correlations stay in [-1, 1]', () => {
    const sim = new Simulation({params: small}).run(300);
    const [probe] = resolveProbes(['traits']);
    const row = probe.sample(sim);
    assert.ok(row.reachProductivityCorr >= -1 && row.reachProductivityCorr <= 1);
    assert.ok(row.reachBuiltCorr >= -1 && row.reachBuiltCorr <= 1);
});
