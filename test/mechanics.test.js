import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMechanics, describeMechanics, MECHANICS_REGISTRY, DEFAULT_MECHANICS} from '../src/mechanics/registry.js';
import {Simulation} from '../src/core/simulation.js';

const small = {seed: 5, initialHumans: 100, forestwidth: 400, forestheight: 300};

test('defaults resolve', () => {
    const m = resolveMechanics();
    for (const key of Object.keys(DEFAULT_MECHANICS)) assert.ok(m[key], `missing ${key}`);
});

test('unknown mechanic or variant throws with a helpful message', () => {
    assert.throws(() => resolveMechanics({nope: 'x'}), /Unknown mechanic/);
    assert.throws(() => resolveMechanics({metabolism: 'nope'}), /Unknown metabolism variant/);
});

test('every registered variant runs without error', () => {
    for (const [mechanic, family] of Object.entries(MECHANICS_REGISTRY)) {
        for (const variant of Object.keys(family)) {
            const config = mechanic === 'terrain'
                ? {params: small, terrain: variant}
                : {params: small, mechanics: {[mechanic]: variant}};
            assert.doesNotThrow(
                () => new Simulation(config).run(60),
                `${mechanic}:${variant} threw`
            );
        }
    }
});

test('every variant conserves resources', () => {
    for (const [mechanic, family] of Object.entries(MECHANICS_REGISTRY)) {
        for (const variant of Object.keys(family)) {
            const config = mechanic === 'terrain'
                ? {params: small, terrain: variant}
                : {params: small, mechanics: {[mechanic]: variant}};
            const sim = new Simulation(config).run(100);
            for (const check of sim.checkConservation(1e-6)) {
                assert.ok(check.ok, `${mechanic}:${variant} leaked resource ${check.resource} by ${check.drift}`);
            }
        }
    }
});

test('reproduction:none holds the population non-increasing', () => {
    const sim = new Simulation({params: small, mechanics: {reproduction: 'none'}}).run(200);
    assert.equal(sim.world.totalBirths, 0);
    assert.ok(sim.world.population <= small.initialHumans);
});

test('lifecycle:never retires nothing', () => {
    const sim = new Simulation({params: {seed: 12345}, mechanics: {lifecycle: 'never'}}).run(300);
    assert.equal(sim.world.trademanager.trades.length, sim.world.trademanager.total_trades_made);
});

test('choosing a non-default mechanic changes the trajectory', () => {
    const base = new Simulation({params: small}).run(120);
    const alt = new Simulation({params: small, mechanics: {valuation: 'needOnly'}}).run(120);
    assert.notEqual(base.hashState(), alt.hashState());
});

test('describeMechanics lists every family with its default', () => {
    const described = describeMechanics();
    for (const [mechanic, info] of Object.entries(described)) {
        assert.ok(info.variants.includes(info.default), `${mechanic} default not among its variants`);
    }
});
