/**
 * Baseline metrics: population, energy, resource stocks, trade counts, conservation.
 *
 * Always enabled. These are the columns every research group needs regardless of its
 * question, and the conservation drift column is the canary for exchange-logic bugs.
 */
import {Probe} from './probe.js';
import {average, sum} from '../core/mathutil.js';

export class CoreProbe extends Probe {
    static probeName = 'core';

    constructor() {
        super();
        this._lastVolumeByLevel = new Map();  // tradeId -> total volume at last sample
        this._lastTradesBuilt = 0;
    }

    sample(sim) {
        const world = sim.world;
        const tm = world.trademanager;
        const params = sim.params;
        const humans = world.humans;

        const energies = humans.map(h => h.totalEnergy());
        const laborers = humans.filter(h => h.is_laborer);
        const producers = humans.filter(h => !h.is_laborer);

        const row = {
            tick: sim.tick,
            population: humans.length,
            births: world.totalBirths,
            deaths: world.totalDeaths,
            totalEnergy: sum(energies),
            avgEnergy: average(energies),
            laborers: laborers.length,
            producers: producers.length,
            avgEnergyLaborers: average(laborers.map(h => h.totalEnergy())),
            avgEnergyProducers: average(producers.map(h => h.totalEnergy())),
            activeTrades: tm.trades.length,
            totalTradesBuilt: tm.total_trades_made,
            maxActiveLevel: tm.maxActiveLevel(),
        };

        // Per-resource stocks, split between agent holdings and trade pools. The pooled
        // share is resources withdrawn from circulation — the "do managers starve the
        // system?" measurement (RESEARCH.md Group 1).
        for (let r = 0; r < params.numResources; r++) {
            let held = 0;
            for (const h of humans) held += h.supply[r];
            let pooled = 0;
            for (const t of tm.trades) pooled += t.supply[r] + t.escrow[r];

            row[`resource${r}_held`] = held;
            row[`resource${r}_pooled`] = pooled;
            row[`resource${r}_total`] = held + pooled;
            row[`resource${r}_produced`] = sim.ledger.produced[r];
            row[`resource${r}_consumed`] = sim.ledger.consumed[r];
            row[`resource${r}_lost`] = sim.ledger.lost[r];
            row[`resource${r}_drift`] = sim.ledger.checkConservation(world, r).drift;
        }

        // Active counts and volume flow per level, for levels 1..4.
        const active = tm.activeCountsByLevel();
        for (let lvl = 1; lvl <= 4; lvl++) row[`activeL${lvl}`] = active[lvl] ?? 0;

        const volumeByLevel = {};
        for (const t of tm.trades) {
            const total = t.totalVolume;
            const prev = this._lastVolumeByLevel.get(t.id) ?? 0;
            volumeByLevel[t.level] = (volumeByLevel[t.level] ?? 0) + Math.max(0, total - prev);
            this._lastVolumeByLevel.set(t.id, total);
        }
        for (let lvl = 1; lvl <= 4; lvl++) row[`volumeL${lvl}`] = volumeByLevel[lvl] ?? 0;

        row.newTrades = tm.total_trades_made - this._lastTradesBuilt;
        this._lastTradesBuilt = tm.total_trades_made;

        return row;
    }

    summary(sim) {
        const world = sim.world;
        const tm = world.trademanager;
        const drifts = sim.checkConservation(Infinity).map(c => Math.abs(c.drift));

        return {
            finalPopulation: world.population,
            totalBirths: world.totalBirths,
            totalDeaths: world.totalDeaths,
            finalActiveTrades: tm.trades.length,
            totalTradesBuilt: tm.total_trades_made,
            maxLevelReached: Math.max(0, ...Object.keys(tm.totalTradesByLevel).map(Number)),
            maxActiveLevel: tm.maxActiveLevel(),
            builtL1: tm.totalTradesByLevel[1] ?? 0,
            builtL2: tm.totalTradesByLevel[2] ?? 0,
            builtL3: tm.totalTradesByLevel[3] ?? 0,
            builtL4plus: Object.entries(tm.totalTradesByLevel)
                .filter(([lvl]) => Number(lvl) >= 4)
                .reduce((a, [, n]) => a + n, 0),
            maxConservationDrift: Math.max(0, ...drifts),
            finalStateHash: sim.hashState(),
            rngDraws: sim.rng.drawCount,
        };
    }
}
