/**
 * Exchange: what a "trade" is.
 *
 * - `postedTrades` (historical default) — trades are first-class, invented objects: posted
 *   rates visible within reach, managed, stacked into hierarchies. The goldens were captured
 *   under this.
 * - `pairwise` — no trade objects. Agents swap directly with their neighbours on a social
 *   network (wired by the `linkFormation` mechanic) at rates negotiated from their own and
 *   their neighbours' valuations. Built to study implicit hierarchy: hubs, brokers, and
 *   flow structure, with nothing explicit to create or manage.
 *
 * Interface: create(sim, world) -> engine (see src/core/exchange.js for the engine contract)
 */
import {PostedTradesExchange, PairwiseExchange} from '../core/exchange.js';

export const EXCHANGE = {
    postedTrades: {
        create(sim, world) { return new PostedTradesExchange(sim, world); },
    },
    pairwise: {
        create(sim, world) { return new PairwiseExchange(sim, world); },
    },
};
