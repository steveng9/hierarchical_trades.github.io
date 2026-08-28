/**
 * An agent.
 *
 * Agents never move. Spatial extent is represented by `socialReach`, a per-agent radius
 * within which they can see neighbours, learn trades, and found new ones. Reach and
 * productivity are heritable, so the population can evolve toward or away from
 * norm-building specialisation.
 *
 * Rule-based throughout: there is no learning and no defection. An agent invokes any visible
 * trade whose posted rate beats its own internal valuation ratio. Adding the possibility of
 * violation is the single mechanic that unlocks Ostrom principles 3–5 (RESEARCH.md Group 2).
 */
import {assert} from './assert.js';
import {distance} from './mathutil.js';
import {Trade} from './trade.js';
import {EVENTS} from './events.js';

export class Human {
    /**
     * @param {import('./simulation.js').Simulation} sim
     * @param {Object} [options] x, y, energy — anything omitted is drawn randomly
     */
    constructor(sim, options = {}) {
        const params = sim.params;
        this.sim = sim;

        // ---------------------------------------------------------------------------
        // NOTE: these four draws are taken unconditionally, even when x/y are supplied.
        // That looks wasteful and is deliberate: the original code evaluated a `defaults`
        // object literal before spreading `options` over it, so a child born at a chosen
        // position still consumed x, y, and reach draws. Skipping them would shift the RNG
        // stream and break every golden trajectory. Do not "optimise" this away.
        // ---------------------------------------------------------------------------
        const drawnX = sim.rng.int(params.forestwidth);
        const drawnY = sim.rng.int(params.forestheight);
        const drawnReach = sim.rng.rightSkew(0.01) * params.social_reach_multiplier;

        this.id = options.id ?? sim.ids.next('human');
        this.x = options.x ?? drawnX;
        this.y = options.y ?? drawnY;
        const energy = options.energy ?? params.initialEnergy;

        this.removeFromWorld = false;
        this.isSpawning = options.isSpawning ?? false;
        this.birthTick = sim.tick;
        this.generation = 0;
        this.parentIds = [];

        this.age = 0;
        this.maxAge = sim.rng.normal(params.maxHumanAge, params.maxHumanAge / 6);
        this.socialReach = options.reach ?? drawnReach;
        this.productivity = sim.rng.float(0, params.production_max);

        this.num_trades_built = 0;
        this.trades_built = Array.from({length: params.numResources}, () =>
            Array.from({length: params.numResources}, () => null)
        );

        this.metabolism = Array(params.numResources).fill(energy / params.numResources);
        this.maxEnergyPerResource = params.maxHumanEnergy / params.numResources;
        this.supply = Array(params.numResources).fill(0);
        this.alternativeSupply = Array(params.numAlternativeResources).fill(0);

        this.personal_valuation_factor = 1;
        this.my_trades = Array.from({length: params.numResources}, () =>
            Array.from({length: params.numResources}, () => [])
        );
        this.resource_valuations = Array(params.numResources + params.numAlternativeResources).fill(1);

        // Role-attribution counters, consumed by the Group 1 value ledger.
        this.volumeTradedFor = Array(params.numResources).fill(0);
        this.totalRoyalties = Array(params.numResources).fill(0);
        this.tradeInvocations = Array(params.numResources).fill(0);
        this.productionTicks = Array(params.numResources).fill(0);
        this.is_laborer = false;
    }

    // -- lifecycle -------------------------------------------------------------------

    update() {
        if (this.isSpawning) return;

        this.spendEnergy(this.sim.params.basicEnergyDepletion);
        this.age++;

        if (this.totalEnergy() <= 0 || this.age >= this.maxAge) {
            this.removeFromWorld = true;
        }

        this.work();
        this.eat();
        this.tryReproduce();
    }

    // -- production ------------------------------------------------------------------

    calculateProductionPotential() {
        let sumHere = 0;
        for (let r = 0; r < this.sim.params.numResources; r++) {
            sumHere += this.sim.world.forest.getConcentration(this.x, this.y, r);
        }
        return this.productivity * sumHere;
    }

    /**
     * Produce resources, or labour.
     *
     * Agents on poor ground become labourers, and labour is the only currency that buys
     * norm construction. The laborer/producer split — set by `production_labor_threshold` —
     * therefore governs how much institution-building the economy can afford at all.
     */
    work() {
        const potential = this.calculateProductionPotential();
        this.is_laborer = potential < this.sim.params.production_labor_threshold;
        if (this.is_laborer && !this.criticallyHungry()) this.labor();
        else this.produce();
    }

    criticallyHungry() {
        return this.totalEnergy() < this.sim.params.maxHumanEnergy / 10;
    }

    produce() {
        const params = this.sim.params;
        const forest = this.sim.world.forest;
        for (let r = 0; r < params.numResources; r++) {
            const concentration = forest.getConcentration(this.x, this.y, r);
            // Cubic in concentration: production is sharply concentrated in the best ground,
            // which is what creates regional specialisation and therefore gains from trade.
            const produced = this.sim.rng.normal(
                this.productivity * Math.pow(concentration, 3),
                concentration * 0.1
            );
            this.supply[r] += produced;
            this.sim.ledger.recordProduced(r, produced);
            if (produced > 0) this.productionTicks[r]++;
            if (params.resourceDepletion) {
                forest.depleteCell(this.x, this.y, r, produced);
            }
        }
        this.spendEnergy(params.workEnergyCost);
    }

    labor() {
        const params = this.sim.params;
        this.alternativeSupply[0] += params.laborPerCycle;
        this.sim.ledger.recordProduced(params.numResources, params.laborPerCycle);
        this.spendEnergy(params.workEnergyCost);
    }

    // -- metabolism (delegated) -------------------------------------------------------

    eat()                  { this.sim.mechanics.metabolism.metabolize(this, this.sim); }
    totalEnergy()          { return this.sim.mechanics.metabolism.totalEnergy(this); }
    spendEnergy(amount)    { this.sim.mechanics.metabolism.spendEnergy(this, amount); }
    updateResourceValuations() {
        this.sim.mechanics.valuation.update(this, this.sim);
        this.pruneDeprecatedTrades();
    }

    tryReproduce() {
        const child = this.sim.mechanics.reproduction.tryReproduce(this, this.sim);
        if (child) {
            this.sim.world.addHuman(child);
            this.sim.world.totalBirths++;
            this.sim.events.emit(EVENTS.HUMAN_BORN, {human: child, parent: this, tick: this.sim.tick});
        }
        return child;
    }

    /** Drop retired trades from this agent's known set. */
    pruneDeprecatedTrades() {
        const n = this.sim.params.numResources;
        for (let r1 = 0; r1 < n; r1++) {
            for (let r2 = 0; r2 < n; r2++) {
                const list = this.my_trades[r1][r2];
                for (let i = list.length - 1; i >= 0; i--) {
                    if (list[i].trade.deprecated) list.splice(i, 1);
                }
            }
        }
    }

    // -- neighbourhood ---------------------------------------------------------------

    humansWithinReach() {
        return this.sim.world.humansWithinReach(this);
    }

    /** Learn every trade already visible at this agent's position. */
    discoverTradesAtBirth() {
        for (const trade of this.sim.world.trademanager.trades) {
            if (trade.deprecated) continue;
            if (!trade.isWithinReach(this)) continue;
            const rA = trade.resourcesIn.A;
            const rB = trade.resourcesIn.B;
            if (!this.my_trades[rA][rB].some(ti => ti.trade === trade)) {
                this.my_trades[rA][rB].push({trade, side: 'A'});
                if (!trade.isHierarchical) {
                    this.my_trades[rB][rA].push({trade, side: 'B'});
                }
            }
        }
    }

    // -- norm construction ------------------------------------------------------------

    /** Best (lowest) XinXout available locally for a resource pair, per side. */
    bestExistingRate(humansWithinReach, r1, r2) {
        let bestA = Infinity;
        let bestB = Infinity;
        for (const human of humansWithinReach) {
            for (const info of human.my_trades[r1][r2]) {
                const t = info.trade;
                if (t.deprecated) continue;
                if (t.XinXout.A < bestA) bestA = t.XinXout.A;
                if (t.XinXout.B < bestB) bestB = t.XinXout.B;
            }
        }
        return {A: bestA, B: bestB};
    }

    /**
     * Found a level-1 trade: a posted exchange rate between two resources, visible to
     * everyone in reach. The inventor pays labour up front and collects the spread after.
     */
    buildTrades() {
        const params = this.sim.params;
        if (params.maxTradeLevel !== null && params.maxTradeLevel < 1) return false;

        const humansWithinReach = this.humansWithinReach();
        if (humansWithinReach.length <= 1) return false;

        const tm = this.sim.world.trademanager;
        for (const [r1, r2] of this.sim.rng.shuffle(tm.allResourcePairs)) {
            // One live trade per inventor per resource pair, to damp redundant churn.
            const existingOwn = this.trades_built[r1][r2];
            if (existingOwn && !existingOwn.deprecated) continue;

            const valueRatios = [];
            let avgTradesAvailable = 0;
            for (const human of humansWithinReach) {
                valueRatios.push(human.resource_valuations[r1] / human.resource_valuations[r2]);
                avgTradesAvailable += human.my_trades[r1][r2].length;
            }
            avgTradesAvailable /= humansWithinReach.length;

            const quote = this.sim.mechanics.pricing.quote({ratios: valueRatios, params});
            assert(quote.spread >= 0, `unexpected negative spread: ${quote.spread}`, {humanId: this.id});

            // Projected takings, discounted hard by how well-served the pair already is.
            const expectedVolume = 2 * quote.spread * humansWithinReach.length *
                params.expected_volume_multiplier / (avgTradesAvailable ** 3 + 1);
            const costToEstablish = Math.pow(this.socialReach, 1 / 2) * params.build_labor_per_reach;

            const r1In = quote.in1, r1Out = quote.out1;
            const r2In = quote.in2, r2Out = quote.out2;

            if (costToEstablish <= this.alternativeSupply[0] &&
                expectedVolume > costToEstablish &&
                r1In / r2Out <= r2In / r1Out
            ) {
                if (params.min_rate_improvement > 0) {
                    const best = this.bestExistingRate(humansWithinReach, r1, r2);
                    const improvesA = best.A === Infinity || (r1In / r2Out) <= best.A * (1 - params.min_rate_improvement);
                    const improvesB = best.B === Infinity || (r2In / r1Out) <= best.B * (1 - params.min_rate_improvement);
                    if (!improvesA && !improvesB) continue;
                }

                const trade = new Trade(this.sim, r1, r2, r1In, r2Out, r2In, r1Out, this);
                this.num_trades_built += 1;
                this.trades_built[r1][r2] = trade;
                tm.register(trade);

                for (const human of humansWithinReach) {
                    human.my_trades[r1][r2].push({trade, side: 'A'});
                    human.my_trades[r2][r1].push({trade, side: 'B'});
                }
                this.alternativeSupply[0] -= costToEstablish;
                this.sim.events.emit(EVENTS.TRADE_BUILT, {trade, inventor: this, level: 1, tick: this.sim.tick});
                return true;   // one trade per turn
            }
        }
        return false;
    }

    /**
     * Found a level-2+ trade on top of an existing one.
     *
     * The parent must have accumulated surplus to sell. Because surplus only pools once the
     * parent is managed or its inventor has died, this is the choke point that makes
     * founder mortality the entry route into hierarchy at default parameters.
     *
     * Identical in structure to `buildTrades` by design — the inductive claim of the model
     * is that no level is special.
     */
    buildMultiLevelTrades() {
        const params = this.sim.params;
        if (this.alternativeSupply[0] <= 0.0001) return false;

        const humansWithinReach = this.humansWithinReach();
        if (humansWithinReach.length <= 1) return false;

        const knownTrades = new Set();
        for (let r1 = 0; r1 < params.numResources; r1++) {
            for (let r2 = 0; r2 < params.numResources; r2++) {
                for (const info of this.my_trades[r1][r2]) knownTrades.add(info.trade);
            }
        }

        for (const parentTrade of this.sim.rng.shuffle([...knownTrades])) {
            if (params.maxTradeLevel !== null && parentTrade.level + 1 > params.maxTradeLevel) continue;

            // One live child per inventor per parent.
            if (parentTrade.childTrades.some(c => !c.deprecated && c.inventor === this)) continue;

            for (let R = 0; R < params.numResources; R++) {
                if (parentTrade.supply[R] < params.minTradeSupplyForHierarchy) continue;

                for (let S = 0; S < params.numResources; S++) {
                    if (S === R) continue;

                    const valueRatios = [];
                    let avgTradesAvailable = 0;
                    for (const human of humansWithinReach) {
                        valueRatios.push(human.resource_valuations[S] / human.resource_valuations[R]);
                        avgTradesAvailable += human.my_trades[S][R].length;
                    }
                    avgTradesAvailable /= humansWithinReach.length;

                    const quote = this.sim.mechanics.pricing.quote({ratios: valueRatios, params});
                    const expectedVolume = 2 * quote.spread * humansWithinReach.length *
                        params.expected_volume_multiplier / (avgTradesAvailable ** 3 + 1);
                    const costToEstablish = Math.pow(this.socialReach, 1 / 2) *
                        params.build_labor_per_reach * params.hierarchicalTradeCostMultiplier;

                    const sIn = quote.in1, sOut = quote.out1;
                    const rIn = quote.in2, rOut = quote.out2;

                    if (costToEstablish <= this.alternativeSupply[0] &&
                        expectedVolume > costToEstablish &&
                        sIn / rOut <= rIn / sOut
                    ) {
                        if (params.min_rate_improvement > 0) {
                            const best = this.bestExistingRate(humansWithinReach, S, R);
                            if (best.A !== Infinity && (sIn / rOut) > best.A * (1 - params.min_rate_improvement)) {
                                continue;
                            }
                        }

                        // Side A faces agents (S in); side B is supplied by the parent (R in).
                        const trade = new Trade(this.sim, S, R, sIn, rOut, rIn, sOut, this, parentTrade, 'B');
                        this.num_trades_built += 1;
                        parentTrade.childTrades.push(trade);
                        this.sim.world.trademanager.register(trade);

                        for (const human of humansWithinReach) {
                            human.my_trades[S][R].push({trade, side: 'A'});
                        }
                        this.alternativeSupply[0] -= costToEstablish;
                        this.sim.events.emit(EVENTS.TRADE_BUILT,
                            {trade, inventor: this, level: trade.level, tick: this.sim.tick});
                        return true;   // one hierarchical trade per turn
                    }
                }
            }
        }
        return false;
    }

    // -- trading ----------------------------------------------------------------------

    /** Invoke trades selected by the active tradeSelection mechanic. */
    makeRandomTrades() {
        const n = this.sim.params.numResources;
        const selector = this.sim.mechanics.tradeSelection;
        let attempted = 0;
        let accepted = 0;

        for (let r1 = 0; r1 < n; r1++) {
            for (let r2 = 0; r2 < n; r2++) {
                if (r1 === r2) continue;

                const selected = selector.select(this, this.my_trades[r1][r2], this.sim);
                for (const info of selected) {
                    const {trade, side} = info;
                    const rIn = trade.resourcesIn[side];
                    const amountIn = this.sim.params.tradeAmountPerInvocation;
                    if (!this.canAffordTrade(rIn, amountIn)) continue;
                    attempted += 1;
                    const traded = trade.invoke(this, side, amountIn);
                    accepted += traded;
                    if (traded > 0) {
                        const rOut = trade.resourceInOppositeSide(side);
                        this.tradeInvocations[rOut]++;
                    }
                }
            }
        }
        return {attempted, accepted};
    }

    /** The posted rate beats what this agent privately thinks the swap is worth. */
    favorsTrade(trade, side, rIn, rOut) {
        return this.resource_valuations[rOut] / this.resource_valuations[rIn] >= trade.XinXout[side];
    }

    canAffordTrade(rIn, amount) {
        if (rIn < this.sim.params.numResources) return this.supply[rIn] >= amount;
        return this.alternativeSupply[rIn - this.sim.params.numResources] >= amount;
    }
}
