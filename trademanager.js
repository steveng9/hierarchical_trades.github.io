
class TradeManager {
    constructor(automata) {
        this.automata = automata;
        this.trades = [
            // new Trade(0, 1, 3, 2.99, 3, 2),
            // new Trade(0, 2, 3, 2.99, 3, 2),
            // new Trade(1, 2, 3, 2.99, 3, 2)
        ];
        this.totalTrades = 0;
        this.totalTradesSucceeded = 0;
        this.all_resource_pairs = allResourcePairs();
        this.all_resource_pairs_with_labor = allResourcePairsWithLabor();
        this.total_trades_made = 0;
        this.clear_unused_trades_ticker = 0;
    }

    update() {
        // todo: change ordering here
        const shuffledHumans = shuffleArray(this.automata.humans);

        for (let human of shuffledHumans) {
            // have humans build trades here?
            // if (human.buildTrades()) break; // only build one trade per cycle?
            human.buildTrades();
            // human.buildMultiLevelTrades();
        }

        for (let human of shuffledHumans) {
            human.updateResourceValuations();
            // human.my_trades = [
            //     {trade: this.trades[0], side: 'A'}, {trade: this.trades[0], side: 'B'},
            //     {trade: this.trades[1], side: 'A'}, {trade: this.trades[1], side: 'B'},
            //     {trade: this.trades[2], side: 'A'}, {trade: this.trades[2], side: 'B'},
            // ];
        }

        for (let human of shuffledHumans) {
            // const result = human.makeOnlyFavorableTrades();
            const result = human.makeRandomTrades();
            // this.totalTrades += result.sumTradesAttempted;
            // this.totalTradesSucceeded += result.sumTradesAccepted;
        }

        for (let trade of this.trades) trade.clearEscrow();

        
        this.clear_unused_trades_ticker += 1;
        if (this.clear_unused_trades_ticker > PARAMS.clear_trades_every) {
            for (let i = this.trades.length - 1; i >= 0; i--) {
                const trade = this.trades[i];
                if (trade.invocations_since_last_checked.A == 0 || trade.invocations_since_last_checked.B == 0) {
                    trade.deprecated = true;
                    this.trades.splice(i, 1);
                }
                trade.invocations_since_last_checked.A = 0;
                trade.invocations_since_last_checked.B = 0;
            }
            this.clear_unused_trades_ticker = 0;
        }
    }

    



}

function allResourcePairs() {
    // const N = PARAMS.numResources + PARAMS.numAlternativeResources;
    const N = PARAMS.numResources;
    const pairs = [];
    // for (let i = 0; i < N; i++) {
    //     for (let j = i+1; j < N; j++) {
    //         pairs.push([i, j]);
    //     }
    // }
    
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (j !== i) pairs.push([i, j]);
        }
    }
    return pairs;
}


function allResourcePairsWithLabor() {
    const N = PARAMS.numResources + PARAMS.numAlternativeResources;
    // const N = PARAMS.numResources;
    const pairs = [];
    // for (let i = 0; i < N; i++) {
    //     for (let j = i+1; j < N; j++) {
    //         pairs.push([i, j]);
    //     }
    // }

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (j !== i) pairs.push([i, j]);
        }
    }
    return pairs;
}