import {PARAMS, gameEngine, isRunning} from '../browser/context.js';
import {Graph} from './graph.js';
import {TimeViewport} from './timeviewport.js';

const ROW_H = 130;   // 100px graph + 30px for label / breathing room

// StatsPanel: 8 time-series graphs displayed in a 2-column × 4-row grid,
// positioned dynamically below the TradeFlowView panel.
export class StatsPanel {
    constructor(tradeFlowView) {
        this.tradeFlowView = tradeFlowView;

        const N = PARAMS.numResources;
        const resLabels  = ['R', 'G', 'B', 'Y', 'P'].slice(0, N);
        const resColors  = ['#cc3333', '#33aa44', '#3355cc', '#cc9922', '#993399'];
        const lvlColors  = ['#44bb44', '#bb4444', '#4488cc', '#bb9933'];

        // Each series starts with [0] so updateMax never sees an empty array.
        // Graph only draws lines once length > 1, so the seed point is invisible.
        this._d = {
            pop:         [[0]],
            lvlPop:      [[0], [0]],                          // laborers, producers head count
            lvlEnergy:   [[0], [0]],                          // laborers, producers avg energy
            resources:   Array.from({length: N}, () => [0]),  // total R, G, B … in system
            supply:      Array.from({length: N}, () => [0]),  // sum of trade.supply[] per resource
            tradeCounts: [[0], [0], [0], [0]],                // active trades L1–L4
            volume:      [[0], [0], [0], [0]],                // volume moved delta/period L1–L4
            newTrades:   [[0], [0]],                          // new L1, new L2+ per period
            totalEnergy: [[0]],                               // sum of all human energy
            // Forest-only totals, interleaved [max0, now0, max1, now1, ...] per resource,
            // summed over cells currently occupied by at least one human. "max" is the
            // undepleted regrowth ceiling (baseGrid) for those same cells — not constant,
            // since which cells count as occupied shifts as the population moves — drawn dashed.
            forestVsMax: Array.from({length: N * 2}, () => [0]),
        };

        // Shared pan/zoom state: passed to every Graph (and, via HistogramPanel, every
        // Histogram) so dragging any one of them scrolls/rescales all of them together.
        this.viewport = new TimeViewport();

        const GW = 600, GH = 100;
        const mk = (data, label, sub) => new Graph(0, 0, data, label, sub, [], GW, GH, [], this.viewport);

        this._graphs = [
            mk(this._d.pop,         'Population',                       []),
            mk(this._d.lvlPop,      'Population: Laborers vs Producers',['laborers', 'producers']),
            mk(this._d.lvlEnergy,   'Avg Energy: Laborers vs Producers',['laborers', 'producers']),
            mk(this._d.resources,   'Resources in System',              resLabels),
            mk(this._d.supply,      'Trade Supply Buffer',              resLabels),
            mk(this._d.tradeCounts, 'Active Trades by Level',           ['L1','L2','L3','L4']),
            mk(this._d.volume,      'Volume Moved / Period by Level',   ['L1','L2','L3','L4']),
            mk(this._d.newTrades,   'New Trades Built / Period',        ['L1','L2+']),
            mk(this._d.totalEnergy, 'Total Population Energy',          []),
        ];

        // Override colors for resource-keyed and level-keyed graphs
        this._graphs[3].colors = resColors;   // resources in system
        this._graphs[4].colors = resColors;   // trade supply buffer
        this._graphs[5].colors = lvlColors;   // active trades by level
        this._graphs[6].colors = lvlColors;   // volume by level

        // Wide graph spanning both columns: forest's undepleted ceiling (dashed) vs what's
        // actually left in the ground right now (solid), per resource, same colour pair.
        const forestGraph = new Graph(0, 0, this._d.forestVsMax, 'Occupied-Cell Forest Resources: Regrowth Ceiling (dashed) vs Current',
            resLabels.flatMap(l => [`${l} max`, `${l} now`]), [], GW * 2 + 20, GH,
            Array.from({length: N * 2}, (_, i) => i % 2 === 0), this.viewport);
        forestGraph.colors = resColors.flatMap(c => [c, c]);
        this._graphs.push(forestGraph);

        // State for delta computations
        this._lastGen         = -1;
        this._lastTradeVol    = new Map();  // trade.id → last observed total volumeMoved
        this._lastTotalByLvl  = {};         // { l1, l2plus }

        // Whichever child graph currently owns an in-progress drag.
        this._activeDrag = null;
    }

    // -- pan/zoom input, routed here from the canvas's mouse listeners -----------------

    handleMouseDown(x, y, shiftKey) {
        for (const g of this._graphs) {
            if (g.handleMouseDown(x, y, shiftKey)) {
                this._activeDrag = g;
                return;
            }
        }
    }

    handleMouseMove(x, y) {
        this._activeDrag?.handleMouseMove(x, y);
    }

    handleMouseUp(x, y) {
        this._activeDrag?.handleMouseUp(x, y);
        this._activeDrag = null;
    }

    // Always sits below the TradeFlowView, which itself sits below the side panels.
    get y() {
        return this.tradeFlowView.y + this.tradeFlowView.panelHeight + PARAMS.margin;
    }

    // Grid rows (2 small graphs each) plus one row for the wide graph.
    get panelHeight() {
        const smallGraphs = this._graphs.length - 1;
        return (Math.ceil(smallGraphs / 2) + 1) * ROW_H;
    }

    _collectData() {
        const automata = gameEngine.automata;
        const humans   = automata.humans;
        const tm       = automata.trademanager;
        const trades   = tm.trades;
        const N        = PARAMS.numResources;

        // --- Population ---
        this._d.pop[0].push(humans.length);

        // --- Population & avg energy: laborers vs producers ---
        let lSum = 0, lCnt = 0, pSum = 0, pCnt = 0;
        for (const h of humans) {
            const e = h.totalEnergy();
            if (h.is_laborer) { lSum += e; lCnt++; }
            else               { pSum += e; pCnt++; }
        }
        this._d.lvlPop[0].push(lCnt);
        this._d.lvlPop[1].push(pCnt);
        this._d.lvlEnergy[0].push(lCnt > 0 ? lSum / lCnt : 0);
        this._d.lvlEnergy[1].push(pCnt > 0 ? pSum / pCnt : 0);

        // --- Resources in system (from automata, includes supply, escrow, metabolism) ---
        for (let r = 0; r < N; r++) {
            this._d.resources[r].push(automata.sum_all_resources(r));
        }

        // --- Trade supply buffer: sum of trade.supply[] across all active trades ---
        const supplySum = Array(N).fill(0);
        for (const t of trades) {
            for (let r = 0; r < N; r++) supplySum[r] += t.supply[r] || 0;
        }
        for (let r = 0; r < N; r++) this._d.supply[r].push(supplySum[r]);

        // --- Active trade counts by level (L1–L4) ---
        const cnt = [0, 0, 0, 0];
        for (const t of trades) {
            const i = t.level - 1;
            if (i >= 0 && i < 4) cnt[i]++;
        }
        for (let i = 0; i < 4; i++) this._d.tradeCounts[i].push(cnt[i]);

        // --- Volume moved per period by level (delta since last collection) ---
        const volDelta = [0, 0, 0, 0];
        const activeIds = new Set();
        for (const t of trades) {
            activeIds.add(t.id);
            const curr = t.volumeMoved.A + t.volumeMoved.B;
            const last = this._lastTradeVol.has(t.id) ? this._lastTradeVol.get(t.id) : curr;
            const i    = t.level - 1;
            if (i >= 0 && i < 4) volDelta[i] += curr - last;
            this._lastTradeVol.set(t.id, curr);
        }
        for (const id of this._lastTradeVol.keys()) {
            if (!activeIds.has(id)) this._lastTradeVol.delete(id);
        }
        for (let i = 0; i < 4; i++) this._d.volume[i].push(volDelta[i]);

        // --- New trades built per period ---
        const byLvl    = tm.totalTradesByLevel;
        const l1Now    = byLvl[1] || 0;
        const l2pNow   = Object.entries(byLvl)
            .filter(([k]) => parseInt(k) >= 2)
            .reduce((s, [, v]) => s + v, 0);
        this._d.newTrades[0].push(l1Now  - (this._lastTotalByLvl.l1  ?? l1Now));
        this._d.newTrades[1].push(l2pNow - (this._lastTotalByLvl.l2p ?? l2pNow));
        this._lastTotalByLvl.l1  = l1Now;
        this._lastTotalByLvl.l2p = l2pNow;

        // --- Total energy across all humans ---
        this._d.totalEnergy[0].push(humans.reduce((s, h) => s + h.totalEnergy(), 0));

        // --- Forest resources: undepleted ceiling vs what's currently in the ground, scoped
        // to cells a human currently occupies. A community confined to one corner of the map
        // shouldn't have its depletion diluted by untouched resources elsewhere.
        const forest = automata.forestModel;
        const occupied = new Set();
        for (const h of humans) {
            const row = Math.floor(h.y / PARAMS.cellSize);
            const col = Math.floor(h.x / PARAMS.cellSize);
            if (row >= 0 && row < forest.rows && col >= 0 && col < forest.cols) {
                occupied.add(row * forest.cols + col);
            }
        }
        const cells = Array.from(occupied, key => [Math.floor(key / forest.cols), key % forest.cols]);
        const {now, max} = forest.resourceTotals(N, cells);
        for (let r = 0; r < N; r++) {
            this._d.forestVsMax[2 * r].push(max[r]);
            this._d.forestVsMax[2 * r + 1].push(now[r]);
        }
    }

    update() {}

    draw(ctx) {
        // Collect once per reporting period; skip while paused (circles wouldn't be accumulating anyway)
        const gen = gameEngine.automata.generation;
        if (isRunning && gen !== this._lastGen && gen % PARAMS.reportingPeriod === 0) {
            this._lastGen = gen;
            this._collectData();
        }

        // 2-column grid, matching the panel margins used by other views. The last graph is
        // wide (spans both columns) and always gets its own row after the grid, whatever the
        // grid's height turns out to be — so adding/removing a small graph needs no layout edit.
        const panelY = this.y;
        const col1X  = PARAMS.margin;
        const col2X  = PARAMS.margin + 620;  // 600px graph + 20px gap
        const rowH   = ROW_H;

        const smallGraphs = this._graphs.length - 1;
        for (let i = 0; i < smallGraphs; i++) {
            const g = this._graphs[i];
            g.x = i % 2 === 0 ? col1X : col2X;
            g.y = panelY + Math.floor(i / 2) * rowH;
            g.draw(ctx);
        }

        const wide = this._graphs[this._graphs.length - 1];
        wide.x = col1X;
        wide.y = panelY + Math.ceil(smallGraphs / 2) * rowH;
        wide.draw(ctx);
    }
}
