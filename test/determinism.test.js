/**
 * Determinism and basic behaviour of the default run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/core/simulation.js';

test('a default run builds trades and reaches level 2', () => {
    const sim = new Simulation({params: {seed: 12345}}).run(200);
    assert.ok(sim.world.trademanager.totalTradesByLevel[2] > 0);
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
