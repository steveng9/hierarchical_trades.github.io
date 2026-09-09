import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMechanics, describeMechanics, MECHANICS_REGISTRY, DEFAULT_MECHANICS} from '../src/mechanics/registry.js';
import {Simulation} from '../src/core/simulation.js';
import {MATCHING} from '../src/mechanics/matching.js';

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

test('matching:distanceFriction ramps smoothly from zero and respects the max cap', () => {
    const sim = {params: {wrapped: false, tradeFrictionSteepness: 3, tradeFrictionMaxFraction: 0.9}, world: {wrapDims: () => null}};
    const a = {x: 0, y: 0, socialReach: 50};
    const near = {x: 0.5, y: 0, socialReach: 50};       // 1% of reachCap
    const far = {x: 5000, y: 0, socialReach: 10};       // 500x reachCap

    const nearFraction = MATCHING.distanceFriction.frictionFraction(a, near, sim);
    const farFraction = MATCHING.distanceFriction.frictionFraction(a, far, sim);

    assert.ok(nearFraction >= 0 && nearFraction < 0.1, `expected near-zero friction at short range, got ${nearFraction}`);
    assert.ok(farFraction > nearFraction, 'friction should increase with distance');
    assert.ok(farFraction <= sim.params.tradeFrictionMaxFraction + 1e-9, 'friction should never exceed the configured cap');

    // A high-reach counterpart keeps the same physical distance cheap (ratio stays small).
    const farButHighReach = {x: 5000, y: 0, socialReach: 50000};
    const cheapFraction = MATCHING.distanceFriction.frictionFraction(a, farButHighReach, sim);
    assert.ok(cheapFraction < farFraction, 'larger reach on either side should reduce friction at the same distance');
});

test('matching:frictionless never withholds, matching:distanceFriction changes the trajectory but conserves', () => {
    const base = new Simulation({params: small}).run(150);
    const friction = new Simulation({params: small, mechanics: {matching: 'distanceFriction'}}).run(150);

    assert.notEqual(base.hashState(), friction.hashState());
    for (const check of friction.checkConservation(1e-6)) {
        assert.ok(check.ok, `distanceFriction leaked resource ${check.resource} by ${check.drift}`);
    }
});
