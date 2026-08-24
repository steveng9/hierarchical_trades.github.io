/**
 * Regression net for the kernel refactor.
 *
 * The goldens were captured from the ORIGINAL flat browser scripts (see
 * tools/golden-capture.mjs) with `Math.random` replaced by a seeded stream. The refactored
 * `src/` kernel must reproduce them tick-for-tick.
 *
 * If one of these fails, the kernel's dynamics have changed. That is only ever acceptable as
 * a deliberate, documented decision — in which case recapture the golden in the same commit
 * and say why in the message.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Simulation} from '../src/core/simulation.js';

function checkGolden(file) {
    const golden = JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
    const sim = new Simulation({params: {seed: golden.seed}});
    const hashes = [];
    sim.run(golden.ticks, {onTick: s => hashes.push(s.hashState())});

    for (let i = 0; i < golden.hashes.length; i++) {
        assert.equal(hashes[i], golden.hashes[i],
            `trajectory diverged at tick ${i + 1} (seed ${golden.seed})`);
    }
    assert.equal(sim.rng.drawCount, golden.rngDraws, 'RNG draw count diverged');
    assert.equal(sim.world.population, golden.finalPopulation, 'final population diverged');
    assert.deepEqual(sim.world.trademanager.totalTradesByLevel, golden.tradesByLevel,
        'trades built per level diverged');
    return sim;
}

test('kernel reproduces the 200-tick golden trajectory', () => {
    const sim = checkGolden('./fixtures/golden-fast.json');
    // The fast golden reaches level 2, so it exercises the hierarchy path.
    assert.ok(sim.world.trademanager.totalTradesByLevel[2] > 0);
});

test('kernel reproduces the 1000-tick golden trajectory', {skip: !process.env.RUN_SLOW && 'set RUN_SLOW=1 to run (~40s)'}, () => {
    checkGolden('./fixtures/golden-deep.json');
});

test('identical seeds produce identical runs', () => {
    const a = new Simulation({params: {seed: 555, initialHumans: 100}}).run(50);
    const b = new Simulation({params: {seed: 555, initialHumans: 100}}).run(50);
    assert.equal(a.hashState(), b.hashState());
    assert.equal(a.rng.drawCount, b.rng.drawCount);
});

test('different seeds produce different runs', () => {
    const a = new Simulation({params: {seed: 1, initialHumans: 100}}).run(50);
    const b = new Simulation({params: {seed: 2, initialHumans: 100}}).run(50);
    assert.notEqual(a.hashState(), b.hashState());
});

test('simulations in one process do not share id counters', () => {
    const a = new Simulation({params: {seed: 3, initialHumans: 30}}).run(20);
    const b = new Simulation({params: {seed: 3, initialHumans: 30}}).run(20);
    // Static id counters would make the second run's ids continue from the first.
    assert.equal(a.hashState(), b.hashState());
});
