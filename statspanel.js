
// StatsPanel: 8 time-series graphs displayed in a 2-column × 4-row grid,
// positioned dynamically below the TradeFlowView panel.
class StatsPanel {
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
            lvlEnergy:   [[0], [0]],                          // laborers, producers avg energy
            resources:   Array.from({length: N}, () => [0]),  // total R, G, B … in system
            supply:      Array.from({length: N}, () => [0]),  // sum of trade.supply[] per resource
            tradeCounts: [[0], [0], [0], [0]],                // active trades L1–L4
            volume:      [[0], [0], [0], [0]],                // volume moved delta/period L1–L4
            newTrades:   [[0], [0]],                          // new L1, new L2+ per period
            totalEnergy: [[0]],                               // sum of all human energy
        };

        const GW = 600, GH = 100;
        const mk = (data, label, sub) => new Graph(0, 0, data, label, sub, [], GW, GH);

        this._graphs = [
            mk(this._d.pop,         'Population',                       []),
            mk(this._d.lvlEnergy,   'Avg Energy: Laborers vs Producers',['laborers', 'producers']),
            mk(this._d.resources,   'Resources in System',              resLabels),
            mk(this._d.supply,      'Trade Supply Buffer',              resLabels),
            mk(this._d.tradeCounts, 'Active Trades by Level',           ['L1','L2','L3','L4']),
            mk(this._d.volume,      'Volume Moved / Period by Level',   ['L1','L2','L3','L4']),
            mk(this._d.newTrades,   'New Trades Built / Period',        ['L1','L2+']),
            mk(this._d.totalEnergy, 'Total Population Energy',          []),
        ];

        // Override colors for resource-keyed and level-keyed graphs
        this._graphs[2].colors = resColors;   // resources in system
        this._graphs[3].colors = resColors;   // trade supply buffer
        this._graphs[4].colors = lvlColors;   // active trades by level
        this._graphs[5].colors = lvlColors;   // volume by level

        // State for delta computations
        this._lastGen         = -1;
        this._lastTradeVol    = new Map();  // trade.id → last observed total volumeMoved
        this._lastTotalByLvl  = {};         // { l1, l2plus }
    }

    // Always sits below the TradeFlowView, which itself sits below the side panels.
    get y() {
        return this.tradeFlowView.y + this.tradeFlowView.panelHeight + PARAMS.margin;
    }

    _collectData() {
        const automata = gameEngine.automata;
        const humans   = automata.humans;
        const tm       = automata.trademanager;
        const trades   = tm.trades;
        const N        = PARAMS.numResources;

        // --- Population ---
        this._d.pop[0].push(humans.length);

        // --- Avg energy: laborers vs producers ---
        let lSum = 0, lCnt = 0, pSum = 0, pCnt = 0;
        for (const h of humans) {
            const e = h.total_energy();
            if (h.is_laborer) { lSum += e; lCnt++; }
            else               { pSum += e; pCnt++; }
        }
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
        this._d.totalEnergy[0].push(humans.reduce((s, h) => s + h.total_energy(), 0));
    }

    update() {}

    draw(ctx) {
        // Collect once per reporting period; skip while paused (circles wouldn't be accumulating anyway)
        const gen = gameEngine.automata.generation;
        if (isRunning && gen !== this._lastGen && gen % PARAMS.reportingPeriod === 0) {
            this._lastGen = gen;
            this._collectData();
        }

        // 2-column × 4-row layout, matching the panel margins used by other views
        const panelY = this.y;
        const col1X  = PARAMS.margin;
        const col2X  = PARAMS.margin + 620;  // 600px graph + 20px gap
        const rowH   = 130;                  // 100px graph + 30px for label / breathing room

        const layout = [
            [col1X, 0], [col2X, 0],
            [col1X, 1], [col2X, 1],
            [col1X, 2], [col2X, 2],
            [col1X, 3], [col2X, 3],
        ];

        for (let i = 0; i < this._graphs.length; i++) {
            const g = this._graphs[i];
            g.x = layout[i][0];
            g.y = panelY + layout[i][1] * rowH;
            g.draw(ctx);
        }
    }
}
