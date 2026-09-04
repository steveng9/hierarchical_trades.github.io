/**
 * Browser entry point.
 *
 * Boots the app and publishes the small surface that index.html's inline script depends on.
 * Those go on `window` deliberately: the page's inline script is a classic script and cannot
 * import from a module.
 *
 * ## Load ordering
 *
 * Module scripts are deferred, so this file runs before `DOMContentLoaded` and therefore
 * before the inline `window.onload` handler. By the time that handler calls
 * `initParamInputs()` and installs the canvas listeners, `window.PARAMS`, `window.gameEngine`
 * and the simulation all exist.
 *
 * Input handling (mouse, spacebar) and saved-configuration management stay in index.html,
 * which already implements them — duplicating them here would double-bind every listener.
 */
import {BrowserApp} from './app.js';
import {gameEngine, toggleRunning, setRunning} from './context.js';
import {readParameterInputs, writeParameterInputs, readMechanicInputs} from './domutil.js';
import {defaultParams} from '../core/params.js';

let app = null;

function boot() {
    const canvas = document.getElementById('gameWorld');
    const ctx = canvas.getContext('2d');

    app = new BrowserApp(ctx);

    // Seed the control panel from the schema defaults BEFORE the first read. Several
    // sliders carry no `value` attribute, so an unseeded input reports its range midpoint
    // rather than the parameter's default — which would silently start the simulation on a
    // configuration nobody chose.
    writeParameterInputs(defaultParams());

    reset();
    app.start();

    console.log(`Hierarchical Trades — seed ${app.sim.params.seed}, fingerprint ${app.sim.paramsFingerprint}`);
}

/**
 * Rebuild the simulation.
 *
 * `base` supplies every parameter that has no control-panel slider (e.g. `forestwidth`) — it
 * defaults to the outgoing simulation's own resolved params, so a plain "Reset Simulation"
 * click carries those non-UI values forward instead of silently reverting them to whatever
 * the schema's default currently is. `loadFullParams` below passes a different `base` when a
 * saved config should replace them instead.
 */
function reset(base) {
    setRunning(true);
    base = base ?? app.sim?.params ?? defaultParams();
    app.reset(Object.assign({}, base, readParameterInputs()), readMechanicInputs());
    writeParameterInputs(app.sim.params);
}

/**
 * Rebuild the simulation from a full parameter set — e.g. a saved config — rather than from
 * the previous run's values. Any key the set doesn't have (a config saved before that
 * parameter existed) falls back to the schema default, not the outgoing simulation's value:
 * this is the one path where NOT carrying the previous run's params forward is correct.
 */
function loadFullParams(params) {
    const full = Object.assign({}, defaultParams(), params);
    writeParameterInputs(full);
    reset(full);
}

function resetNewSeed() {
    const seedInput = document.getElementById('seed');
    const current = parseInt(seedInput?.value) || 0;
    if (seedInput) seedInput.value = current + 1;
    reset();
}

function pause() {
    toggleRunning();
}

/**
 * Pull the control panel into the live parameter object.
 *
 * Kept for the inline `saveConfig()`, which calls this and then snapshots `PARAMS`.
 */
function loadParameters() {
    Object.assign(app.sim.params, readParameterInputs());
    return app.sim.params;
}

function toggleSocialReach() {
    app.sim.params.show_social_reach = !app.sim.params.show_social_reach;
}

/** "Clear Selection" button: drop every selection state across all views, not just humans. */
function clearSelection() {
    app.datamanager?.humanDataView?.clearSelection();

    const view = app.forestView;
    if (view) {
        view.selectedTrade = null;
        view.tradeDisplayLevel = 0;
    }
    if (app.datamanager?.tradeDataView) {
        app.datamanager.tradeDataView.selectedTrade = null;
    }

    const btn = document.getElementById('levelDisplayBtn');
    if (btn) btn.textContent = 'Level Display: OFF';
}

/** Cycle the forest overlay: OFF -> L1 -> L2 -> ... -> OFF. */
function cycleTradeLevel() {
    const view = app.forestView;
    const maxLevel = app.sim.world.trademanager.trades
        .reduce((m, t) => (t.deprecated ? m : Math.max(m, t.level)), 0);

    view.tradeDisplayLevel = view.tradeDisplayLevel >= maxLevel ? 0 : view.tradeDisplayLevel + 1;
    view.selectedTrade = null;

    const btn = document.getElementById('levelDisplayBtn');
    if (btn) {
        btn.textContent = view.tradeDisplayLevel === 0
            ? 'Level Display: OFF'
            : `Level Display: L${view.tradeDisplayLevel}`;
    }
}

// The surface index.html's inline script calls. `PARAMS` is a getter so that
// `Object.assign(PARAMS, savedConfig)` in loadConfigByIndex mutates the live parameters.
Object.defineProperties(window, {
    PARAMS: {get: () => app?.sim?.params ?? defaultParams(), configurable: true},
    app:    {get: () => app, configurable: true},
});
Object.assign(window, {
    reset, resetNewSeed, pause, loadParameters, loadFullParams, toggleSocialReach, clearSelection, cycleTradeLevel,
    gameEngine, defaultParams,
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
