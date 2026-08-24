import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/core/simulation.js';

const small = {seed: 42, initialHumans: 120, forestwidth: 400, forestheight: 300};

test('resources are conserved across a run', () => {
    const sim = new Simulation({params: small}).run(300);
    for (const check of sim.checkConservation(1e-6)) {
        assert.ok(check.ok, `resource ${check.resource} drifted by ${check.drift}`);
    }
});

test('conservation holds with depletion disabled', () => {
    const sim = new Simulation({params: {...small, resourceDepletion: false}}).run(200);
    for (const check of sim.checkConservation(1e-6)) assert.ok(check.ok);
});

test('maxTradeLevel = 0 suppresses all trade', () => {
    const sim = new Simulation({params: {...small, maxTradeLevel: 0}}).run(300);
    assert.equal(sim.world.trademanager.total_trades_made, 0);
    assert.equal(sim.world.trademanager.trades.length, 0);
});

test('maxTradeLevel = 1 permits level-1 trades but no hierarchy', () => {
    const sim = new Simulation({params: {seed: 12345, maxTradeLevel: 1}}).run(400);
    const byLevel = sim.world.trademanager.totalTradesByLevel;
    assert.ok((byLevel[1] ?? 0) > 0, 'expected level-1 trades');
    assert.equal(byLevel[2] ?? 0, 0, 'expected no level-2 trades');
});

test('unlimited depth reaches level 2 on the reference seed', () => {
    const sim = new Simulation({params: {seed: 12345}}).run(400);
    assert.ok((sim.world.trademanager.totalTradesByLevel[2] ?? 0) > 0);
});

test('tick advances exactly once per step', () => {
    const sim = new Simulation({params: small});
    assert.equal(sim.tick, 0);
    sim.step();
    assert.equal(sim.tick, 1);
    sim.run(10);
    assert.equal(sim.tick, 11);
});

test('run(until) stops early', () => {
    const sim = new Simulation({params: small});
    sim.run(1000, {until: s => s.tick >= 25});
    assert.equal(sim.tick, 25);
});

test('summary reports a coherent snapshot', () => {
    const sim = new Simulation({params: small}).run(100);
    const s = sim.summary();
    assert.equal(s.tick, 100);
    assert.equal(s.population, sim.world.population);
    assert.equal(s.stateHash, sim.hashState());
    assert.ok(s.rngDraws > 0);
});

test('population survives a long baseline run', () => {
    const sim = new Simulation({params: {seed: 12345}}).run(500);
    assert.ok(sim.world.population > 0, 'population collapsed');
});
