/**
 * Spatial probe — where institutions are, and how their footprints evolve.
 *
 * No new kernel events. Subscribes to the existing vocabulary and reads (x, y, reach)
 * from the objects already in each payload.
 *
 * Two output channels:
 *   - sample() returns light aggregate metrics (for the timeseries table).
 *   - attach() logs per-event coordinates AND periodic full-footprint snapshots
 *     to JSONL streams via emit().
 */
import {Probe} from './probe.js';
import {EVENTS} from '../core/events.js';

export class SpatialProbe extends Probe {
    static probeName = 'spatial';

    constructor() {
        super();
        this._emit = null;
    }

    attach(sim, emit) {
        this._emit = emit;

        sim.events.on(EVENTS.TRADE_BUILT, ({trade, inventor, level, tick}) => {
            emit('spatial-events', {
                event: 'trade:built',
                tick,
                tradeId: trade.id,
                level,
                inventorId: inventor.id,
                x: inventor.x,
                y: inventor.y,
                reach: inventor.socialReach,
            });
        });

        sim.events.on(EVENTS.TRADE_DEPRECATED, ({trade, cause, tick}) => {
            const inv = trade.inventor;
            emit('spatial-events', {
                event: 'trade:deprecated',
                tick,
                tradeId: trade.id,
                level: trade.level,
                cause,
                x: inv ? inv.x : null,
                y: inv ? inv.y : null,
            });
        });

        emit('spatial-terrain', {
            width: sim.params.forestwidth,
            height: sim.params.forestheight,
            cellSize: sim.params.cellSize,
            numResources: sim.params.numResources,
            grid: sim.world.forest.baseGrid,
        });

        sim.events.on(EVENTS.MANAGER_ADDED, ({trade, human, tick}) => {
            emit('spatial-events', {
                event: 'manager:added',
                tick,
                tradeId: trade.id,
                tradeLevel: trade.level,
                managerId: human.id,
                x: human.x,
                y: human.y,
                reach: human.socialReach,
            });
        });

    }

    _emitSnapshots(sim, tick) {
        const trades = sim.world.trademanager.trades;
        const byId = new Map();
        for (const h of sim.world.humans) byId.set(h.id, h);

        for (const trade of trades) {
            const inv = trade.inventor;
            const agents = [];
            const seen = new Set();

            if (inv && !inv.removeFromWorld) {
                agents.push({id: inv.id, role: 'inventor', x: inv.x, y: inv.y, reach: inv.socialReach});
                seen.add(inv.id);
            }
            for (const m of trade.managers) {
                if (!m.removeFromWorld && !seen.has(m.id)) {
                    agents.push({id: m.id, role: 'manager', x: m.x, y: m.y, reach: m.socialReach});
                    seen.add(m.id);
                }
            }
            for (const [key, lastTick] of trade.trade_partners) {
                if (tick - lastTick > 50) continue;
                const [idA, idB] = key.split('-').map(Number);
                for (const pid of [idA, idB]) {
                    if (seen.has(pid)) continue;
                    const human = byId.get(pid);
                    if (human) {
                        agents.push({id: human.id, role: 'partner', x: human.x, y: human.y, reach: human.socialReach});
                        seen.add(pid);
                    }
                }
            }

            this._emit('spatial-snapshots', {
                tick,
                tradeId: trade.id,
                level: trade.level,
                parentTradeId: trade.parentTrade?.id ?? null,
                deprecated: trade.deprecated,
                agents,
            });
        }
    }

    sample(sim) {
        if (this._emit) this._emitSnapshots(sim, sim.tick);

        const trades = sim.world.trademanager.trades;
        if (trades.length === 0) {
            return {tick: sim.tick, numTrades: 0, numTradesL2plus: 0, meanParticipants: 0, spatialExtent: 0};
        }

        let totalParticipants = 0;
        let maxExtent = 0;
        let l2plus = 0;

        for (const trade of trades) {
            if (trade.level >= 2) l2plus++;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let count = 0;

            const visit = (h) => {
                if (!h || h.removeFromWorld) return;
                minX = Math.min(minX, h.x - h.socialReach);
                maxX = Math.max(maxX, h.x + h.socialReach);
                minY = Math.min(minY, h.y - h.socialReach);
                maxY = Math.max(maxY, h.y + h.socialReach);
                count++;
            };

            visit(trade.inventor);
            for (const m of trade.managers) visit(m);

            totalParticipants += count;
            if (count > 0) {
                const extent = Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
                maxExtent = Math.max(maxExtent, extent);
            }
        }

        return {
            tick: sim.tick,
            numTrades: trades.length,
            numTradesL2plus: l2plus,
            meanParticipants: totalParticipants / trades.length,
            spatialExtent: maxExtent,
        };
    }

    summary() {
        return {};
    }
}
