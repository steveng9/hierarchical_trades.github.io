/**
 * Browser-layer smoke test.
 *
 * Canvas output cannot be verified automatically here — this proves the *structure* holds:
 * every render module resolves, the app constructs a simulation, every panel's `draw()`
 * executes without throwing, and reset tears down and rebuilds cleanly.
 *
 * Visual correctness still needs a human looking at the page. What this catches is the
 * failure mode a refactor actually produces: a broken import, a renamed field, an undefined
 * global.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

/** Records every drawing call and returns plausible values for the few queries views make. */
function makeRecordingContext() {
    const calls = [];
    const canvas = {width: 1240, height: 2600};
    const target = {
        canvas,
        measureText: text => ({width: String(text).length * 6}),
        createLinearGradient: () => ({addColorStop() {}}),
        getImageData: () => ({data: new Uint8ClampedArray(4)}),
        setLineDash() {},
    };
    return {
        calls,
        ctx: new Proxy(target, {
            get(obj, prop) {
                if (prop in obj) return obj[prop];
                // Any other property is a drawing method or a style setter.
                return (...args) => { calls.push({method: String(prop), args}); };
            },
            set(obj, prop, value) {
                calls.push({method: `set:${String(prop)}`, args: [value]});
                obj[prop] = value;
                return true;
            },
        }),
    };
}

/** Minimal DOM surface, installed before importing any browser module. */
function installDomShim() {
    const element = {
        classList: {add() {}, remove() {}, toggle() {}},
        addEventListener() {},
        style: {},
        textContent: '',
        checked: false,
        value: '',
        type: 'text',
        getContext: () => makeRecordingContext().ctx,
        width: 1240,
        height: 2600,
    };
    globalThis.document = {
        getElementById: () => element,
        querySelectorAll: () => [],
        createElement: () => element,
        addEventListener() {},
        readyState: 'complete',
        activeElement: {tagName: 'BODY'},
    };
    globalThis.window = globalThis;
    globalThis.requestAnimationFrame = () => 0;
    globalThis.localStorage = {
        _s: new Map(),
        getItem(k) { return this._s.get(k) ?? null; },
        setItem(k, v) { this._s.set(k, v); },
    };
}

installDomShim();
const {BrowserApp} = await import('../src/browser/app.js');
const context = await import('../src/browser/context.js');
const {Simulation} = await import('../src/core/simulation.js');

test('app constructs a simulation and every view', () => {
    const {ctx} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    const sim = app.reset({seed: 99, initialHumans: 80, forestwidth: 400, forestheight: 300});

    assert.ok(sim, 'no simulation');
    assert.equal(sim.params.seed, 99);
    assert.ok(app.forestView, 'no forest view');
    assert.ok(app.datamanager, 'no data manager');
    assert.ok(app.selection, 'no selection manager');
    assert.ok(app.graphs.length > 0, 'no panels registered');
    assert.ok(app.clickCapableGraphs.length > 0, 'no clickable panels registered');
});

test('context live bindings follow the active simulation', () => {
    const {ctx} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    app.reset({seed: 7, initialHumans: 60, surplus_multiplier: 0.35});

    assert.equal(context.PARAMS.surplus_multiplier, 0.35);
    assert.equal(context.sim.params.seed, 7);
    // The compatibility shim must reach the same objects the kernel owns.
    assert.equal(context.gameEngine.automata.humans, app.sim.world.humans);
    assert.equal(context.gameEngine.automata.generation, app.sim.tick);
});

test('a full frame draws without throwing', () => {
    const {ctx, calls} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    app.reset({seed: 5, initialHumans: 80, forestwidth: 400, forestheight: 300, updatesPerDraw: 2});

    for (let frame = 0; frame < 5; frame++) {
        assert.doesNotThrow(() => app.loop(), `frame ${frame} threw`);
    }
    assert.ok(calls.length > 0, 'nothing was drawn');
    assert.ok(app.sim.tick > 0, 'simulation did not advance');
});

test('frames draw after hierarchy has formed', () => {
    const {ctx} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    app.reset({seed: 12345});
    app.sim.run(400);
    assert.ok(app.sim.world.trademanager.maxActiveLevel() >= 1);
    assert.doesNotThrow(() => app.draw(), 'draw threw with an active hierarchy');
});

test('trade overlays draw for a selected trade at every level', () => {
    const {ctx} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    app.reset({seed: 12345});
    app.sim.run(400);

    for (const trade of app.sim.world.trademanager.trades.slice(0, 12)) {
        app.forestView.selectTrade(trade);
        assert.doesNotThrow(() => app.draw(), `overlay threw for L${trade.level} trade ${trade.id}`);
    }
    app.forestView.selectedTrade = null;

    for (let level = 0; level <= app.sim.world.trademanager.maxActiveLevel(); level++) {
        app.forestView.tradeDisplayLevel = level;
        assert.doesNotThrow(() => app.draw(), `level overlay ${level} threw`);
    }
});

test('reset rebuilds cleanly without stacking panels', () => {
    const {ctx} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    app.reset({seed: 1, initialHumans: 50});
    const panelCount = app.graphs.length;
    const clickableCount = app.clickCapableGraphs.length;

    app.reset({seed: 2, initialHumans: 50});
    assert.equal(app.graphs.length, panelCount, 'panels accumulated across reset');
    assert.equal(app.clickCapableGraphs.length, clickableCount, 'clickable panels accumulated');

    // Ids must restart, not continue from the previous simulation.
    assert.ok(app.sim.world.humans[0].id <= 50);
});

test('reset preserves the trade-level display mode', () => {
    const {ctx} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    app.reset({seed: 1, initialHumans: 40});
    app.forestView.tradeDisplayLevel = 2;
    app.reset({seed: 1, initialHumans: 40});
    assert.equal(app.forestView.tradeDisplayLevel, 2);
});

test('the interactive path advances the world exactly like a headless run', () => {
    const {ctx} = makeRecordingContext();
    const app = new BrowserApp(ctx);
    const params = {seed: 4242, initialHumans: 100, forestwidth: 400, forestheight: 300};
    app.reset(params);
    for (let i = 0; i < 40; i++) app.sim.step();

    const headless = new Simulation({params}).run(40);
    assert.equal(app.sim.hashState(), headless.hashState(),
        'browser and headless trajectories diverged');
});
