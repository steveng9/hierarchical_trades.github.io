/**
 * Trade selection: how an agent chooses which trade to invoke for a given resource pair.
 *
 * Interface: select(human, tradesForPair, sim) -> [{trade, side}]
 *   Returns the subset of tradesForPair that the agent should invoke this tick.
 */

export const TRADE_SELECTION = {
    /**
     * Historical default: invoke every known trade whose posted rate beats the agent's
     * personal valuation. No ranking, no comparison between trades.
     */
    invokeAll: {
        select(human, tradesForPair, sim) {
            const result = [];
            for (const info of sim.rng.shuffle(tradesForPair)) {
                const {trade, side} = info;
                const rIn = trade.resourcesIn[side];
                const rOut = trade.resourceInOppositeSide(side);
                if (human.favorsTrade(trade, side, rIn, rOut)) {
                    result.push(info);
                }
            }
            return result;
        },
    },

    /**
     * Best-rate selection with optional loyalty.
     *
     * For each resource pair the agent invokes at most one trade — the one with the
     * lowest XinXout (best rate). With tradeLoyaltyThreshold > 0, the agent sticks with
     * its current trade unless a competitor offers a rate that is better by at least δ.
     *
     * At δ = 0 this is pure rate-optimization; at δ = 1 the agent never switches.
     */
    bestRate: {
        select(human, tradesForPair, sim) {
            let best = null;
            let bestRate = Infinity;

            for (const info of tradesForPair) {
                const {trade, side} = info;
                const rIn = trade.resourcesIn[side];
                const rOut = trade.resourceInOppositeSide(side);
                if (!human.favorsTrade(trade, side, rIn, rOut)) continue;
                if (!human.canAffordTrade(rIn, 1)) continue;
                if (trade.XinXout[side] < bestRate) {
                    bestRate = trade.XinXout[side];
                    best = info;
                }
            }

            if (!best) return [];

            const threshold = sim.params.tradeLoyaltyThreshold;
            if (threshold > 0 && human._preferredTrades) {
                const rIn = best.trade.resourcesIn[best.side];
                const rOut = best.trade.resourceInOppositeSide(best.side);
                const key = rIn * sim.params.numResources + rOut;
                const current = human._preferredTrades.get(key);

                if (current && !current.trade.deprecated &&
                    human.favorsTrade(current.trade, current.side, rIn, rOut) &&
                    human.canAffordTrade(rIn, 1)) {
                    const currentRate = current.trade.XinXout[current.side];
                    if (bestRate >= currentRate * (1 - threshold)) {
                        return [current];
                    }
                }
                human._preferredTrades.set(key, best);
            } else if (threshold > 0) {
                human._preferredTrades = new Map();
                const rIn = best.trade.resourcesIn[best.side];
                const rOut = best.trade.resourceInOppositeSide(best.side);
                human._preferredTrades.set(rIn * sim.params.numResources + rOut, best);
            }

            return [best];
        },
    },
};
