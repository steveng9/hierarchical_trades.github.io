class DataManager {
    constructor(automata) {
        this.automata = automata;
        this.vis_graph_frequency = 10;

        // population data
        this.simSpeeds = [];
        this.humanPopulation = [];
        this.humans_analyzed = [];
        this.laborers = 0;

        // Initialize the Histogram instance for visualization
        let graphX = PARAMS.margin;
        let graphY = PARAMS.margin + PARAMS.forestheight + PARAMS.margin;

        
        gameEngine.addGraph(new HumanDataView(graphX, graphY));
        
        gameEngine.addGraph(new VariableViewer(graphX, graphY + 500, "Variables", () => ({
            "generation": this.automata.generation,
            "simulation speed (gen / sec)": gameEngine.updatesPerSecond.toFixed(2),
            // "sum trades": gameEngine.automata.trademanager.totalTrades,
            // "sum trades succeeded": gameEngine.automata.trademanager.totalTradesSucceeded.toFixed(2),
            "total R": gameEngine.total_existing_actual[0].toFixed(2),
            "Expected R": gameEngine.total_existing_expected[0].toFixed(2),
            "num laborers": this.laborers,
            "total trades built": gameEngine.automata.trademanager.total_trades_made,
            "total trades": gameEngine.automata.trademanager.trades.length,
        })));


        gameEngine.clickCapableGraphs.push(new TradeDataView(graphX + PARAMS.leftpanelWidth + PARAMS.margin, graphY ))
        gameEngine.addGraph(new SelectionDataView(graphX + PARAMS.leftpanelWidth + PARAMS.margin, graphY + PARAMS.margin + 300, this));
        // gameEngine.addGraph(new Graph(graphX, graphY + 650, [this.simSpeeds], "simulation speed (gen / sec)"));

        // gameEngine.addGraph(new VariableHistogramViewer(graphX, 785 + graphY, "Average Q Values"));
    }


    updateData() {
        let humanPop = this.automata.humans.length;
        this.humanPopulation.push(humanPop);
        this.simSpeeds.push(gameEngine.updatesPerSecond);

        for (var i = this.humans_analyzed.length - 1; i >= 0; --i) {
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
        const forest = this.automata.forest;
        this.humans_analyzed = [];
        for (let human of this.automata.humans) {
            if (human.x >= x1 && human.x <= x2 && human.y >= y1 && human.y <= y2) {
                this.humans_analyzed.push(human);
            }
        }
    }

    logData() {
    }

    update() {
        // Update data each frame
        if(this.automata.generation % PARAMS.reportingPeriod === 0) this.updateData();

    }

    draw(ctx) {
        // Draw the histogram, handled by the Histogram class in the game engine
    }
}
