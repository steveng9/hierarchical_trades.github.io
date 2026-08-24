/**
 * Value accounting — Group 1's single experiment.
 *
 * Collapses five separate questions into one instrumented sample: do managers starve the
 * system, is a fiefdom productive or wasteful, how does wealth distribute across roles, is
 * total value equal to the labour put in, and how do role proportions move over time.
 *
 * ## Roles
 *
 * Roles are not exclusive and are derived, not declared: an agent is a *laborer* on ticks it
 * labours, an *inventor* if it holds a live trade, and a *manager* if it appears in any
 * trade's manager set. An agent can be all three. That overlap is intentional — the question
 * is where value accrues, not how to partition the population.
 */
import {Probe} from './probe.js';
import {average, gini, sum} from '../core/mathutil.js';

export class ValueLedgerProbe extends Probe {
    static probeName = 'value';

    sample(sim) {
        const world = sim.world;
        const tm = world.trademanager;
        const params = sim.params;
        const humans = world.humans;
        if (humans.length === 0) return {tick: sim.tick, population: 0};

        const managers = new Set();
        const inventors = new Set();
        for (const trade of tm.trades) {
            for (const m of trade.managers) managers.add(m);
            if (trade.inventor && !trade.inventor.removeFromWorld) inventors.add(trade.inventor);
        }

        const laborers = humans.filter(h => h.is_laborer);
        const managerList = humans.filter(h => managers.has(h));
        const inventorList = humans.filter(h => inventors.has(h));
        const plain = humans.filter(h => !managers.has(h) && !inventors.has(h) && !h.is_laborer);

        const energyOf = h => h.totalEnergy();
        const royaltiesOf = h => sum(h.totalRoyalties);

        const row = {
            tick: sim.tick,
            population: humans.length,

            // Role proportions over time.
            fracLaborers: laborers.length / humans.length,
            fracManagers: managerList.length / humans.length,
            fracInventors: inventorList.length / humans.length,
            fracUnaffiliated: plain.length / humans.length,

            // Where energy accrues.
            avgEnergyLaborers: average(laborers.map(energyOf)),
            avgEnergyManagers: average(managerList.map(energyOf)),
            avgEnergyInventors: average(inventorList.map(energyOf)),
            avgEnergyUnaffiliated: average(plain.map(energyOf)),

            // Inequality.
            giniEnergy: gini(humans.map(energyOf)),
            giniRoyalties: gini(humans.map(royaltiesOf)),
            totalRoyaltiesPaid: sum(humans.map(royaltiesOf)),
        };

        // Resources withdrawn from circulation into trade pools. The literal
        // "do managers starve the system?" measurement.
        let heldTotal = 0;
        let pooledTotal = 0;
        for (let r = 0; r < params.numResources; r++) {
            for (const h of humans) heldTotal += h.supply[r];
            for (const t of tm.trades) pooledTotal += t.supply[r] + t.escrow[r];
        }
        row.resourcesHeld = heldTotal;
        row.resourcesPooled = pooledTotal;
        row.fracPooled = (heldTotal + pooledTotal) > 0 ? pooledTotal / (heldTotal + pooledTotal) : 0;

        // Circulation velocity: volume moved per unit of resource in existence. Falling
        // velocity alongside rising pooled share is the signature of an extractive hierarchy.
        let volume = 0;
        for (const t of tm.trades) volume += t.totalVolume;
        row.cumulativeVolume = volume;
        row.velocity = (heldTotal + pooledTotal) > 0 ? volume / (heldTotal + pooledTotal) : 0;

        // The conservation identity, in value terms: produced = consumed + held + lost.
        row.totalProduced = sum(sim.ledger.produced.slice(0, params.numResources));
        row.totalConsumed = sum(sim.ledger.consumed.slice(0, params.numResources));
        row.totalLost = sum(sim.ledger.lost.slice(0, params.numResources));
        row.laborProduced = sim.ledger.produced[params.numResources] ?? 0;

        return row;
    }

    summary(sim) {
        const final = this.sample(sim) ?? {};
        return {
            finalFracPooled: final.fracPooled ?? 0,
            finalGiniEnergy: final.giniEnergy ?? 0,
            finalGiniRoyalties: final.giniRoyalties ?? 0,
            finalVelocity: final.velocity ?? 0,
            finalFracManagers: final.fracManagers ?? 0,
            finalFracLaborers: final.fracLaborers ?? 0,
            totalRoyaltiesPaid: final.totalRoyaltiesPaid ?? 0,
            totalLaborProduced: final.laborProduced ?? 0,
        };
    }
}
