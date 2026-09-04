/**
 * Browser view context.
 *
 * The view layer was written against three globals — `PARAMS`, `gameEngine`, and
 * `isRunning`. Rather than rewrite ~2000 lines of drawing code to thread a context object
 * through every method (churn with no benefit), those names are provided here as ES module
 * live bindings, so a view's `import {PARAMS}` sees the current simulation's parameters
 * after every reset.
 *
 * `gameEngine` is a deliberate compatibility shim, not part of the architecture. It adapts
 * the kernel's names to the ones the views already use. Nothing under `src/core`,
 * `src/mechanics`, `src/probes`, or `src/experiment` may import from this file — the kernel
 * must never depend on the presence of a browser.
 */
import {defaultParams} from '../core/params.js';

/** @type {import('../core/simulation.js').Simulation|null} */
export let sim = null;

/** Live binding: always the active simulation's resolved parameters. */
export let PARAMS = defaultParams();

/** Paused state, toggled by the spacebar and the Pause button. */
export let isRunning = true;

/** @type {import('./app.js').BrowserApp|null} */
export let app = null;

export function setSimulation(newSim) {
    sim = newSim;
    PARAMS = newSim.params;
}

export function setApp(newApp) {
    app = newApp;
}

export function setRunning(value) {
    isRunning = value;
}

export function toggleRunning() {
    isRunning = !isRunning;
    return isRunning;
}

/**
 * Adapter presenting the kernel under the names the view layer expects.
 *
 * `automata` maps onto `sim.world`, and `generation` onto `sim.tick` — the world no longer
 * owns the clock, but the views still ask for it by the old name.
 */
export const gameEngine = {
    get ctx()               { return app?.ctx ?? null; },
    get updatesPerSecond()  { return app?.updatesPerSecond ?? 0; },
    get clickCapableGraphs(){ return app?.clickCapableGraphs ?? []; },
    get dragCapableGraphs() { return app?.dragCapableGraphs ?? []; },
    addGraph(graph)         { app?.addGraph(graph); },

    get selection()         { return app?.selection ?? null; },

    get total_produced()          { return sim?.ledger.produced ?? []; },
    get total_consumed()          { return sim?.ledger.consumed ?? []; },
    get total_lost()              { return sim?.ledger.lost ?? []; },
    get total_existing_actual()   { return app?.totalExistingActual ?? []; },
    get total_existing_expected() { return app?.totalExistingExpected ?? []; },
    get conservation_drift()      { return app?.conservationDrift ?? []; },

    get automata() {
        if (!sim) return null;
        const world = sim.world;
        return {
            get generation()   { return sim.tick; },
            get humans()       { return world.humans; },
            get humanById()    { return world.humanById; },
            // Deliberately the VIEW, not the model. Views ask `automata.forest` for canvas
            // coordinates and `selectTrade`, which are view concerns; ForestView delegates
            // grid access, so it is a safe superset of the model's read surface.
            get forest()       { return app?.forestView ?? world.forest; },
            get forestModel()  { return world.forest; },
            get trademanager() { return world.trademanager; },
            get totalBirths()  { return world.totalBirths; },
            get datamanager()  { return app?.datamanager ?? null; },
            sum_all_resources: r => world.sumAllResources(r),
            add_human: human => world.addHuman(human),
            add_human_at: (x, y) => world.addHumanAt(x, y),
        };
    },
};
