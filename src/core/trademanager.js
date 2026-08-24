/**
 * Trade lifecycle: construction ordering, execution, escrow settlement, and retirement.
 *
 * The per-tick ordering here is load-bearing. All agents build before any agent trades, so
 * within a tick nobody gets first-mover advantage from acting earlier in the array; and the
 * population is shuffled once and that same order reused for all four passes, which keeps
 * the phases consistent with one another.
 */
import {LIFECYCLE} from '../mechanics/lifecycle.js';

export class TradeManager {
    constructor(sim) {
        this.sim = sim;
        this.trades = [];
        this.total_trades_made = 0;
        this.totalTradesByLevel = {};
        this.cleanupTicker = 0;

        this.allResourcePairs = orderedPairs(sim.params.numResources);
        this.allResourcePairsWithLabor = orderedPairs(
            sim.params.numResources + sim.params.numAlternativeResources
        );

        /** Retired trades, retained for survival analysis. Cleared by `drainRetired`. */
        this.retired = [];
    }

    register(trade) {
        this.trades.push(trade);
        this.total_trades_made += 1;
        this.totalTradesByLevel[trade.level] = (this.totalTradesByLevel[trade.level] || 0) + 1;
    }

    update() {
        // One shuffle, reused across all phases: re-shuffling per phase would decouple the
        // build order from the trade order and change the dynamics.
        const humans = this.sim.rng.shuffle(this.sim.world.humans);

        for (const human of humans) human.buildTrades();
        for (const human of humans) human.buildMultiLevelTrades();
        for (const human of humans) human.updateResourceValuations();
        for (const human of humans) human.makeRandomTrades();

        // Level-1 trades escrow unmatched offers within a tick; settle them here.
        for (const trade of this.trades) trade.clearEscrow(this.sim.ledger);

        this.cleanupTicker += 1;
        if (this.cleanupTicker > this.sim.params.clear_trades_every) {
            this.cleanupTrades();
            this.cleanupTicker = 0;
        }
    }

    /**
     * Periodic maintenance: propagate manager reach, drop dead managers, cascade
     * deprecation, and retire trades the lifecycle policy rejects.
     */
    cleanupTrades() {
        const policy = this.sim.mechanics.lifecycle ?? LIFECYCLE.idleWindow;
        const humans = this.sim.world.humans;

        for (let i = this.trades.length - 1; i >= 0; i--) {
            const trade = this.trades[i];

            trade.flushNewManagers(humans);
            trade.cleanDeadManagers();

            if (trade.parentTrade?.deprecated && !trade.deprecated) {
                trade.deprecate('parent-deprecated');
            }
            if (!trade.deprecated) {
                const cause = policy.shouldDeprecate(trade, this.sim);
                if (cause) trade.deprecate(cause);
            }

            if (trade.deprecated) {
                // Anything still pooled in a retired trade leaves the economy.
                for (let r = 0; r < this.sim.params.numResources; r++) {
                    this.sim.ledger.recordLost(r, trade.supply[r]);
                }
                this.trades.splice(i, 1);
                this.retired.push(trade);
            }

            trade.invocations_since_last_checked.A = 0;
            trade.invocations_since_last_checked.B = 0;
        }
    }

    /** Hand off retired trades to a probe and stop retaining them. */
    drainRetired() {
        const out = this.retired;
        this.retired = [];
        return out;
    }

    /** Count of live trades at each level. */
    activeCountsByLevel() {
        const counts = {};
        for (const trade of this.trades) {
            counts[trade.level] = (counts[trade.level] || 0) + 1;
        }
        return counts;
    }

    maxActiveLevel() {
        let max = 0;
        for (const trade of this.trades) if (trade.level > max) max = trade.level;
        return max;
    }
}

/** All ordered (i, j) pairs with i !== j. */
function orderedPairs(n) {
    const pairs = [];
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            if (j !== i) pairs.push([i, j]);
        }
    }
    return pairs;
}
