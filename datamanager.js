class DataManager {
    constructor(automata) {
        this.automata = automata;
        this.vis_graph_frequency = 10;

        this.simSpeeds = [];
        this.humanPopulation = [];
        this.humans_analyzed = [];
        this.laborers = 0;

        // Layout: panels below the forest
        const leftX = PARAMS.margin;
        const rightX = PARAMS.margin + PARAMS.leftpanelWidth + PARAMS.margin;
        const belowForestY = PARAMS.margin + PARAMS.forestheight + PARAMS.margin;

        // Left column: HumanDataView (clickable) + VariableViewer
        const hdv = new HumanDataView(leftX, belowForestY);
        gameEngine.addGraph(hdv);
        gameEngine.clickCapableGraphs.push(hdv);
        this.humanDataView = hdv;

        gameEngine.addGraph(new VariableViewer(leftX, belowForestY + hdv.panelHeight + PARAMS.margin, "Variables", () => ({
            "generation": this.automata.generation,
            "sim speed (gen/s)": gameEngine.updatesPerSecond.toFixed(0),
            "num humans": this.automata.humans.length,
            "births": this.automata.totalBirths,
            "num laborers": this.laborers,
            "active trades": gameEngine.automata.trademanager.trades.length,
            "total built": gameEngine.automata.trademanager.total_trades_made,
            "by level": Object.entries(gameEngine.automata.trademanager.totalTradesByLevel).map(([k, v]) => `L${k}:${v}`).join(' ') || '--',
            "total R": gameEngine.total_existing_actual[0].toFixed(2),
            "expected R": gameEngine.total_existing_expected[0].toFixed(2),
            "produced R": gameEngine.total_produced[0].toFixed(2),
            "consumed R": gameEngine.total_consumed[0].toFixed(2),
            "lost R": gameEngine.total_lost[0].toFixed(2),
        })));

        // Right column: TradeDataView + SelectionDataView
        const tdv = new TradeDataView(rightX, belowForestY);
        gameEngine.clickCapableGraphs.push(tdv);
        this.tradeDataView = tdv;

        gameEngine.addGraph(new SelectionDataView(rightX, belowForestY + tdv.panelHeight + PARAMS.margin, this));
    }

    updateData() {
        this.humanPopulation.push(this.automata.humans.length);
        this.simSpeeds.push(gameEngine.updatesPerSecond);

        for (let i = this.humans_analyzed.length - 1; i >= 0; --i) {
            if (this.humans_analyzed[i].removeFromWorld) {
                this.humans_analyzed.splice(i, 1);
            }
        }

        this.laborers = 0;
        for (let human of gameEngine.automata.humans) {
            if (human.is_laborer) this.laborers += 1;
        }
    }

    analyze_humans_in(x1, x2, y1, y2) {
        this.humans_analyzed = [];
        for (let human of this.automata.humans) {
            if (human.x >= x1 && human.x <= x2 && human.y >= y1 && human.y <= y2) {
                this.humans_analyzed.push(human);
            }
        }
    }

    logData() {}

    update() {
        if (this.automata.generation % PARAMS.reportingPeriod === 0) this.updateData();
    }

    draw(ctx) {}
}
