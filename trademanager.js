
class TradeManager {
    constructor(automata) {
        this.automata = automata;
        this.trades = [];
        this.totalTrades = 0;
        this.totalTradesSucceeded = 0;
        this.all_resource_pairs = allResourcePairs();
        this.all_resource_pairs_with_labor = allResourcePairsWithLabor();
        this.total_trades_made = 0;
        this.clear_unused_trades_ticker = 0;

        // Track total trades ever built per level (persists even after deprecation)
        this.totalTradesByLevel = {};
    }

    update() {
        const shuffledHumans = shuffleArray(this.automata.humans);

        // 1. Build level-1 trades
        for (let human of shuffledHumans) {
            human.buildTrades();
        }

        // 2. Build hierarchical trades (level-2+)
        for (let human of shuffledHumans) {
            human.buildMultiLevelTrades();
        }

        // 3. Update valuations
        for (let human of shuffledHumans) {
            human.updateResourceValuations();
        }

        // 4. Execute trades (all levels — agents invoke the same way)
        for (let human of shuffledHumans) {
            human.makeRandomTrades();
        }

        // 5. Clear escrows (level-1 trades use escrow; hierarchical trades don't on backed side)
        for (let trade of this.trades) {
            trade.clearEscrow();
        }

        // 6. Periodic cleanup
        this.clear_unused_trades_ticker += 1;
        if (this.clear_unused_trades_ticker > PARAMS.clear_trades_every) {
            this.cleanupTrades();
            this.clear_unused_trades_ticker = 0;
        }
    }

    cleanupTrades() {
        for (let i = this.trades.length - 1; i >= 0; i--) {
            const trade = this.trades[i];

            // Clean dead managers
            trade.cleanDeadManagers();

            // Deprecate if parent is deprecated
            if (trade.parentTrade?.deprecated && !trade.deprecated) {
                trade.deprecate();
            }

            // Remove unused trades (not invoked on both sides for level-1, or agent side for hierarchical)
            if (!trade.deprecated) {
                if (trade.isHierarchical) {
                    const agentSide = trade.agentSide();
                    if (trade.invocations_since_last_checked[agentSide] === 0) {
                        trade.deprecate();
                    }
                } else {
                    if (trade.invocations_since_last_checked.A === 0 || trade.invocations_since_last_checked.B === 0) {
                        trade.deprecate();
                    }
                }
            }

            // Remove deprecated trades from the active list
            if (trade.deprecated) {
                this.trades.splice(i, 1);
            }

            // Reset invocation counters
            trade.invocations_since_last_checked.A = 0;
            trade.invocations_since_last_checked.B = 0;
        }
    }
}

function allResourcePairs() {
    const N = PARAMS.numResources;
    const pairs = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (j !== i) pairs.push([i, j]);
        }
    }
    return pairs;
}

function allResourcePairsWithLabor() {
    const N = PARAMS.numResources + PARAMS.numAlternativeResources;
    const pairs = [];
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            if (j !== i) pairs.push([i, j]);
        }
    }
    return pairs;
}
