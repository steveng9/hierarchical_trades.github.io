/**
 * Browser application shell.
 *
 * Replaces the old `GameEngine`. Owns the canvas, the render loop, the view instances, and
 * the interactive simulation — but no simulation logic: `sim.step()` is the only way the
 * world advances, exactly as in a headless run. The interactive and batch paths therefore
 * cannot diverge.
 */
import {Simulation} from '../core/simulation.js';
import {setSimulation, setApp, isRunning, PARAMS} from './context.js';
import {ForestView} from '../render/forestview.js';
import {drawHuman} from '../render/humanview.js';
import {DataManager} from '../render/datamanager.js';
import {SelectionManager} from '../render/selectionmanager.js';

class Timer {
    constructor() {
        this.gameTime = 0;
        this.maxStep = 0.05;
        this.wallLastTimestamp = 0;
    }
    tick() {
        const now = performance.now();
        const wallDelta = (now - this.wallLastTimestamp) / 1000;
        this.wallLastTimestamp = now;
        const gameDelta = Math.min(wallDelta, this.maxStep);
        this.gameTime += gameDelta;
        return gameDelta;
    }
}

export class BrowserApp {
    constructor(ctx) {
        this.ctx = ctx;
        this.surfaceWidth = ctx.canvas.width;
        this.surfaceHeight = ctx.canvas.height;
        this.timer = new Timer();

        this.graphs = [];
        this.clickCapableGraphs = [];
        this.dragCapableGraphs = [];
        this.updateCount = 0;
        this.updatesPerSecond = 0;
        this.lastSecond = performance.now();

        this.sim = null;
        this.forestView = null;
        this.datamanager = null;
        this.selection = null;
        this.totalExistingActual = [];
        this.totalExistingExpected = [];
        this.conservationDrift = [];

        setApp(this);
    }

    addGraph(graph) {
        this.graphs.push(graph);
    }

    /**
     * Rebuild the simulation and every view.
     *
     * View state that should survive a reset (currently the trade-level display mode) is
     * captured before teardown and restored after.
     */
    reset(paramOverrides = {}, mechanicOverrides = {}) {
        const savedDisplayLevel = this.forestView?.tradeDisplayLevel ?? 0;

        this.graphs = [];
        this.clickCapableGraphs = [];
        this.dragCapableGraphs = [];

        this.sim = new Simulation({
            params: paramOverrides,
            mechanics: mechanicOverrides,
            strictParams: false,
            clampRanges: true,
        });
        setSimulation(this.sim);

        const total = this.sim.params.numResources + this.sim.params.numAlternativeResources;
        this.totalExistingActual = Array(total).fill(0);
        this.totalExistingExpected = Array(total).fill(0);
        this.conservationDrift = Array(total).fill(0);

        this.forestView = new ForestView(this.sim.world.forest);
        this.forestView.tradeDisplayLevel = savedDisplayLevel;

        this.datamanager = new DataManager(this.sim.world);
        this.selection = new SelectionManager(this.forestView);

        return this.sim;
    }

    start() {
        const loop = () => {
            this.loop();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    loop() {
        if (isRunning) {
            this.timer.tick();
            let steps = PARAMS.updatesPerDraw;
            while (steps-- > 0) {
                this.sim.step();
                this.datamanager.update();
                this.updateCount++;
            }

            if (PARAMS.show_debug_info) {
                const now = performance.now();
                const delta = now - this.lastSecond;
                if (delta >= PARAMS.periodic_check_interval) {
                    this.updatesPerSecond = this.updateCount / (delta / 1000);
                    this.updateCount = 0;
                    this.lastSecond = now;
                    for (let r = 0; r < PARAMS.numResources; r++) {
                        this.totalExistingActual[r] = this.sim.ledger.actual(this.sim.world, r);
                        this.totalExistingExpected[r] = this.sim.ledger.expected(r);
                        const check = this.sim.ledger.checkConservation(this.sim.world, r);
                        this.conservationDrift[r] = check.drift;
                    }
                }
            }
        }
        // Always draw, so selection changes remain visible while paused.
        this.draw();
    }

    draw() {
        if (this.sim.tick % PARAMS.reportingPeriod !== 0) return;
        const ctx = this.ctx;

        const panelsY = PARAMS.margin + PARAMS.forestheight + PARAMS.margin;
        ctx.clearRect(0, 0, this.surfaceWidth, panelsY);

        this.forestView.draw(ctx);
        for (const human of this.sim.world.humans) drawHuman(ctx, human, this.forestView);
        this.forestView.drawTradeLines(ctx);

        ctx.clearRect(0, panelsY, ctx.canvas.width, ctx.canvas.height - panelsY);
        for (const graph of this.graphs) graph.draw(ctx);
        for (const graph of this.clickCapableGraphs) graph.draw(ctx);

        this.selection?.draw(ctx);
    }

    /** Route a canvas click to whichever panel claims it. */
    handleClick(x, y) {
        for (const graph of this.clickCapableGraphs) {
            if (graph.handleClick?.(x, y)) return true;
        }
        return false;
    }
}
