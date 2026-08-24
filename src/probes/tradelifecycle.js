/**
 * Trade survival: the direct instrumentation for Thesis A.
 *
 * Emits one row per retired trade carrying everything a survival analysis needs — lifespan,
 * level, whether it ever acquired children or managers, and critically whether it outlived
 * its founder. The headline comparison is the lifespan distribution of trades that acquired
 * a hierarchy against those that did not (RESEARCH.md 4a).
 *
 * Interpretation warning: under the default `idleWindow` lifecycle policy, a trade dies
 * after a single quiet cleanup window, so lifespans quantise onto multiples of
 * `clear_trades_every`. Run survival analysis under `lifecycle: 'graceCounter'` or the
 * distribution is measuring the retirement policy.
 */
import {Probe} from './probe.js';
import {EVENTS} from '../core/events.js';

export class TradeLifecycleProbe extends Probe {
    static probeName = 'lifecycle';

    constructor() {
        super();
        this._records = new Map();   // tradeId -> mutable record
        this._completed = [];
    }

    attach(sim, emit) {
        this._emit = emit;

        sim.events.on(EVENTS.TRADE_BUILT, ({trade, inventor, level}) => {
            this._records.set(trade.id, {
                tradeId: trade.id,
                level,
                inventorId: inventor.id,
                inventorReach: inventor.socialReach,
                inventorProductivity: inventor.productivity,
                parentTradeId: trade.parentTrade?.id ?? null,
                birthTick: trade.birthTick,
                // Neighbourhood conditions at founding — candidate predictors of durability.
                foundingDensity: sim.world.humansWithinReach(inventor).length,
                foundingSpread: trade.surpluses.A + trade.surpluses.B,
                resourceA: trade.resourcesIn.A,
                resourceB: trade.resourcesIn.B,
                peakManagers: 0,
                everHadChildren: 0,
                inventorDiedTick: null,
            });
        });

        sim.events.on(EVENTS.MANAGER_ADDED, ({trade}) => {
            const rec = this._records.get(trade.id);
            if (rec) rec.peakManagers = Math.max(rec.peakManagers, trade.managers.size);
        });

        sim.events.on(EVENTS.HUMAN_DIED, ({human, tick}) => {
            // Founder death is the bootstrap into hierarchy at default parameters, so the
            // gap between it and the trade's own death is the quantity of interest.
            for (const rec of this._records.values()) {
                if (rec.inventorId === human.id && rec.inventorDiedTick === null) {
                    rec.inventorDiedTick = tick;
                }
            }
        });

        sim.events.on(EVENTS.TRADE_DEPRECATED, ({trade, cause, tick}) => {
            const rec = this._records.get(trade.id);
            if (!rec) return;
            rec.everHadChildren = trade.childTrades.length > 0 ? 1 : 0;
            rec.childCount = trade.childTrades.length;
            rec.deathTick = tick;
            rec.lifespan = tick - rec.birthTick;
            rec.cause = cause;
            rec.totalVolume = trade.totalVolume;
            rec.totalInvocations = trade.totalInvocations;
            rec.finalManagers = trade.managers.size;
            // The Thesis A variable: did the norm outlive the person who made it?
            rec.outlivedFounder = rec.inventorDiedTick !== null && tick > rec.inventorDiedTick ? 1 : 0;
            rec.ticksAfterFounderDeath = rec.inventorDiedTick !== null ? tick - rec.inventorDiedTick : null;

            this._completed.push(rec);
            this._records.delete(trade.id);
            if (this._emit) this._emit('trades', rec);
        });
    }

    summary(sim) {
        // Include trades still alive at the end, flagged as right-censored for survival analysis.
        const censored = [];
        for (const trade of sim.world.trademanager.trades) {
            const rec = this._records.get(trade.id);
            if (!rec) continue;
            const finished = {
                ...rec,
                deathTick: null,
                lifespan: sim.tick - rec.birthTick,
                cause: 'censored',
                censored: 1,
                everHadChildren: trade.childTrades.length > 0 ? 1 : 0,
                childCount: trade.childTrades.length,
                totalVolume: trade.totalVolume,
                totalInvocations: trade.totalInvocations,
                finalManagers: trade.managers.size,
                outlivedFounder: rec.inventorDiedTick !== null ? 1 : 0,
            };
            censored.push(finished);
            if (this._emit) this._emit('trades', finished);
        }

        const all = [...this._completed, ...censored];
        const withHierarchy = all.filter(r => r.everHadChildren === 1);
        const without = all.filter(r => r.everHadChildren === 0);
        const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

        return {
            tradesObserved: all.length,
            tradesCensored: censored.length,
            meanLifespan: mean(all.map(r => r.lifespan)),
            meanLifespanWithHierarchy: mean(withHierarchy.map(r => r.lifespan)),
            meanLifespanWithoutHierarchy: mean(without.map(r => r.lifespan)),
            fractionWithHierarchy: all.length ? withHierarchy.length / all.length : 0,
            fractionOutlivingFounder: all.length ? all.filter(r => r.outlivedFounder === 1).length / all.length : 0,
            meanPeakManagers: mean(all.map(r => r.peakManagers)),
        };
    }
}
