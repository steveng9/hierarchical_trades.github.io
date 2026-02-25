
class Human {
    static lastHumanId = 0;
    constructor(options = {}) {
        const defaults = {
            id: Human.lastHumanId + 1,
            energy: PARAMS.initialEnergy,
            x: randomInt(PARAMS.forestwidth),
            y: randomInt(PARAMS.forestheight),
            reach: sampleRightSkew(.01) * .5,
            isSpawning: false
        };

        const {id, energy, reach, isSpawning, x, y} = { ...defaults, ...options };

        this.x = x;
        this.y = y;
        this.id = id;
        this.forest = gameEngine.automata.forest;
        Human.lastHumanId = id;
        this.removeFromWorld = false;
        this.isSpawning = isSpawning;

        this.age = 0;
        this.maxAge = generateNormalSample(PARAMS.maxHumanAge, PARAMS.maxHumanAge / 20);
        this.socialReach = reach;
        this.productivity = randomFloat(0, 1.2);
        this.num_trades_built = 0;
        this.trades_built = Array.from({ length: PARAMS.numResources }, () =>
            Array.from({ length: PARAMS.numResources }, () => null)
        );

        this.metabolism = Array(PARAMS.numResources).fill(energy / PARAMS.numResources);
        this.maxEnergyPerResource = PARAMS.maxHumanEnergy / PARAMS.numResources;
        this.supply = Array(PARAMS.numResources).fill(0);
        this.alternativeSupply = Array(PARAMS.numAlternativeResources).fill(0);

        // Trading-related
        this.personal_valuation_factor = 1;
        this.my_trades = Array.from({ length: PARAMS.numResources }, () =>
            Array.from({ length: PARAMS.numResources }, () => [])
        );
        this.resource_valuations = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(1);
        this.volumeTradedFor = Array(PARAMS.numResources).fill(0);
        this.totalRoyalties = Array(PARAMS.numResources).fill(0);
    }

    update() {
        if (this.isSpawning) return;

        this.spendEnergy(PARAMS.basicEnergyDepletion);
        this.age++;

        if (this.total_energy() <= 0 || this.age >= this.maxAge) {
            this.removeFromWorld = true;
        }

        this.work();
        this.eat();
        this.tryReproduce();
    }

    draw(ctx) {
        if (this.isSpawning) {
            ctx.fillStyle = "yellow";
            ctx.strokeStyle = "yellow";
        } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#FFFFFF";
        }

        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.forest.x + this.x, this.forest.y + this.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();

        if (PARAMS.show_social_reach) {
            ctx.beginPath();
            ctx.arc(this.forest.x + this.x, this.forest.y + this.y, this.socialReach, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.closePath();
        }

        ctx.font = "12px monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(`H${this.id}`, this.forest.x + this.x + 8, this.forest.y + this.y);
    }

    calculate_production_potential() {
        const sum_resources_here = [...Array(PARAMS.numResources).keys()].reduce(
            (acc, r) => acc + this.forest.getConcentration(this.x, this.y, r), 0
        );
        return this.productivity * sum_resources_here;
    }

    work() {
        const production_potential = this.calculate_production_potential();
        this.is_laborer = production_potential < PARAMS.production_labor_threshold;
        if (this.is_laborer && !this.critically_hungry()) this.labor();
        else this.produce();
    }

    critically_hungry() {
        return this.total_energy() < PARAMS.maxHumanEnergy / 10;
    }

    produce() {
        for (let r = 0; r < PARAMS.numResources; r++) {
            const resourceConcentration = this.forest.getConcentration(this.x, this.y, r);
            const produced = generateNormalSample(this.productivity * Math.pow(resourceConcentration, 3), resourceConcentration * .1);
            this.supply[r] += produced;
            gameEngine.total_produced[r] += produced;
        }
        this.spendEnergy(PARAMS.workEnergyCost);
    }

    labor() {
        this.alternativeSupply[0] += PARAMS.laborPerCycle;
        gameEngine.total_produced[PARAMS.numResources] += PARAMS.laborPerCycle;
        this.spendEnergy(PARAMS.workEnergyCost);
    }

    // Find the best (lowest) XinXout among existing trades for a resource pair in this region
    bestExistingRate(humansWithinReach, r1, r2) {
        let bestA = Infinity;
        let bestB = Infinity;
        for (let human of humansWithinReach) {
            for (let trade_info of human.my_trades[r1][r2]) {
                const t = trade_info.trade;
                if (t.deprecated) continue;
                if (t.XinXout.A < bestA) bestA = t.XinXout.A;
                if (t.XinXout.B < bestB) bestB = t.XinXout.B;
            }
        }
        return {A: bestA, B: bestB};
    }

    // Build level-1 trades between resource pairs among nearby agents
    buildTrades() {
        let anyTradesBuilt = false;
        const humansWithinReach = this.humansWithinReach();
        if (humansWithinReach.length <= 1) return false;

        for (let [r1, r2] of shuffleArray(gameEngine.automata.trademanager.all_resource_pairs)) {
            // Skip if this inventor already has an active trade for this pair
            const existingOwn = this.trades_built[r1][r2];
            if (existingOwn && !existingOwn.deprecated) continue;

            const value_ratios = [];
            let ave_trades_already_available = 0;
            for (let human of humansWithinReach) {
                value_ratios.push(human.resource_valuations[r1] / human.resource_valuations[r2]);
                ave_trades_already_available += human.my_trades[r1][r2].length;
            }
            ave_trades_already_available /= humansWithinReach.length;

            const distribution = meanAndStd(value_ratios);
            const trade_points_distance_from_mean = Math.max(Math.min(distribution.std * PARAMS.surplus_multiplier, distribution.mean / 2), .000001);
            assert(trade_points_distance_from_mean >= 0, `unexpected negative: ${trade_points_distance_from_mean}`);

            const newTradeSurplus_R2 = 2 * trade_points_distance_from_mean;
            const expected_volume = newTradeSurplus_R2 * humansWithinReach.length * PARAMS.expected_volume_multiplier / (ave_trades_already_available ** 3 + 1);
            const cost_to_establish = Math.pow(this.socialReach, 1 / 2) * PARAMS.build_labor_per_reach;
            const r1_in = 1;
            const r1_out = 1;
            const r2_in = distribution.mean + trade_points_distance_from_mean;
            const r2_out = distribution.mean - trade_points_distance_from_mean;

            if (cost_to_establish <= this.alternativeSupply[0] &&
                expected_volume > cost_to_establish &&
                r1_in / r2_out <= r2_in / r1_out
            ) {
                // Check min_rate_improvement against best existing rate in the region
                const newXinXoutA = r1_in / r2_out;
                const newXinXoutB = r2_in / r1_out;
                if (PARAMS.min_rate_improvement > 0) {
                    const best = this.bestExistingRate(humansWithinReach, r1, r2);
                    // New trade must improve on best by at least min_rate_improvement fraction
                    const improvesA = best.A === Infinity || newXinXoutA <= best.A * (1 - PARAMS.min_rate_improvement);
                    const improvesB = best.B === Infinity || newXinXoutB <= best.B * (1 - PARAMS.min_rate_improvement);
                    if (!improvesA && !improvesB) continue;
                }

                anyTradesBuilt = true;

                const newTrade = new Trade(r1, r2, r1_in, r2_out, r2_in, r1_out, this);
                this.num_trades_built += 1;
                this.trades_built[r1][r2] = newTrade;

                const tm = gameEngine.automata.trademanager;
                tm.trades.push(newTrade);
                tm.total_trades_made += 1;
                tm.totalTradesByLevel[1] = (tm.totalTradesByLevel[1] || 0) + 1;

                for (let human of humansWithinReach) {
                    human.my_trades[r1][r2].push({trade: newTrade, side: 'A'});
                    human.my_trades[r2][r1].push({trade: newTrade, side: 'B'});
                }
                this.alternativeSupply[0] -= cost_to_establish;
                break; // one trade per turn
            }
        }
        return anyTradesBuilt;
    }

    // Build hierarchical trades (level-2+): agent exchanges a resource for a trade's accumulated surplus
    buildMultiLevelTrades() {
        if (this.alternativeSupply[0] <= .0001) return false;
        const humansWithinReach = this.humansWithinReach();
        if (humansWithinReach.length <= 1) return false;

        // Collect all unique trades this agent knows about
        const knownTrades = new Set();
        for (let r1 = 0; r1 < PARAMS.numResources; r1++) {
            for (let r2 = 0; r2 < PARAMS.numResources; r2++) {
                for (let trade_info of this.my_trades[r1][r2]) {
                    knownTrades.add(trade_info.trade);
                }
            }
        }

        for (let parentTrade of shuffleArray([...knownTrades])) {
            // Skip if this inventor already has an active child trade on this parent
            const hasActiveChild = parentTrade.childTrades.some(
                c => !c.deprecated && c.inventor === this
            );
            if (hasActiveChild) continue;

            // Check each resource the parent trade has accumulated
            for (let R = 0; R < PARAMS.numResources; R++) {
                if (parentTrade.supply[R] < PARAMS.minTradeSupplyForHierarchy) continue;

                // Parent has significant supply of resource R — look for exchange opportunity
                for (let S = 0; S < PARAMS.numResources; S++) {
                    if (S === R) continue;

                    // Would agents exchange S for R?
                    const value_ratios = [];
                    let ave_trades_already_available = 0;
                    for (let human of humansWithinReach) {
                        value_ratios.push(human.resource_valuations[S] / human.resource_valuations[R]);
                        ave_trades_already_available += human.my_trades[S][R].length;
                    }
                    ave_trades_already_available /= humansWithinReach.length;

                    const distribution = meanAndStd(value_ratios);
                    const trade_points_distance_from_mean = Math.max(
                        Math.min(distribution.std * PARAMS.surplus_multiplier, distribution.mean / 2), .000001
                    );

                    const newTradeSurplus = 2 * trade_points_distance_from_mean;
                    const expected_volume = newTradeSurplus * humansWithinReach.length * PARAMS.expected_volume_multiplier / (ave_trades_already_available ** 3 + 1);
                    const cost_to_establish = Math.pow(this.socialReach, 1 / 2) * PARAMS.build_labor_per_reach * PARAMS.hierarchicalTradeCostMultiplier;

                    // Exchange rates: agents put in S (side A), parent supplies R (side B)
                    const s_in = 1;
                    const s_out = 1;
                    const r_in = distribution.mean + trade_points_distance_from_mean;
                    const r_out = distribution.mean - trade_points_distance_from_mean;

                    if (cost_to_establish <= this.alternativeSupply[0] &&
                        expected_volume > cost_to_establish &&
                        s_in / r_out <= r_in / s_out
                    ) {
                        // Check min_rate_improvement against best existing rate
                        const newXinXoutA = s_in / r_out;
                        if (PARAMS.min_rate_improvement > 0) {
                            const best = this.bestExistingRate(humansWithinReach, S, R);
                            if (best.A !== Infinity && newXinXoutA > best.A * (1 - PARAMS.min_rate_improvement)) {
                                continue;
                            }
                        }

                        // Build hierarchical trade: Side A = agent (S in), Side B = parent-backed (R in)
                        const newTrade = new Trade(S, R, s_in, r_out, r_in, s_out, this, parentTrade, 'B');
                        this.num_trades_built += 1;

                        parentTrade.childTrades.push(newTrade);

                        const tm = gameEngine.automata.trademanager;
                        tm.trades.push(newTrade);
                        tm.total_trades_made += 1;
                        tm.totalTradesByLevel[newTrade.level] = (tm.totalTradesByLevel[newTrade.level] || 0) + 1;

                        // Distribute only the agent-facing side (A) — side B is parent-backed
                        for (let human of humansWithinReach) {
                            human.my_trades[S][R].push({trade: newTrade, side: 'A'});
                        }

                        this.alternativeSupply[0] -= cost_to_establish;
                        return true; // one hierarchical trade per turn
                    }
                }
            }
        }
        return false;
    }

    tryReproduce() {
        if (this.total_energy() < PARAMS.reproductionEnergyThreshold) return;

        // Child gets half the parent's current energy
        const childEnergy = this.total_energy() / 2;
        this.spendEnergy(childEnergy);

        // Spawn nearby
        const angle = Math.random() * 2 * Math.PI;
        const dist = randomFloat(5, 30);
        const cx = Math.max(0, Math.min(PARAMS.forestwidth - 1,  this.x + Math.cos(angle) * dist));
        const cy = Math.max(0, Math.min(PARAMS.forestheight - 1, this.y + Math.sin(angle) * dist));

        // Mutate heritable traits
        const mutate = v => Math.max(0.001, v * (1 + generateNormalSample(0, PARAMS.reproductionMutationRate)));

        const child = new Human({ x: cx, y: cy, energy: childEnergy });
        child.socialReach  = mutate(this.socialReach);
        child.productivity = mutate(this.productivity);
        child.discoverTradesAtBirth();

        gameEngine.automata.add_human(child);
        gameEngine.automata.totalBirths++;
    }

    discoverTradesAtBirth() {
        for (let trade of gameEngine.automata.trademanager.trades) {
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

    humansWithinReach() {
        const humansWithinReach = [];
        for (let human of gameEngine.automata.humans) {
            if (distance(human, this) < this.socialReach) {
                humansWithinReach.push(human);
            }
        }
        return humansWithinReach;
    }

    eat() {
        this.metabolize();
    }

    total_energy() {
        return this.metabolism.reduce((a, b) => a + b, 0);
    }

    metabolize() {
        for (let r = 0; r < PARAMS.numResources; r++) {
            const deficit = this.maxEnergyPerResource - this.metabolism[r];
            const consumed = Math.min(this.supply[r] / 2, .2);
            this.supply[r] -= consumed;
            gameEngine.total_consumed[r] += consumed;
            this.metabolism[r] += consumed * deficit;
        }
    }

    spendEnergy(amount) {
        const total_energy = this.total_energy();
        if (total_energy <= 0) return;
        for (let r = 0; r < PARAMS.numResources; r++) {
            const metabolized = this.metabolism[r];
            this.metabolism[r] -= amount * (metabolized / total_energy);
        }
    }

    updateResourceValuations() {
        for (let r = 0; r < PARAMS.numResources; r++) {
            this.resource_valuations[r] = Math.pow((this.maxEnergyPerResource - this.metabolism[r]) / (this.supply[r] + 1), 1 / 2);
            if (!this.resource_valuations[r]) this.resource_valuations[r] = 1;
        }

        // Clear deprecated trades from known trades
        for (let r1 = 0; r1 < PARAMS.numResources; r1++) {
            for (let r2 = 0; r2 < PARAMS.numResources; r2++) {
                for (let i = this.my_trades[r1][r2].length - 1; i >= 0; i--) {
                    if (this.my_trades[r1][r2][i].trade.deprecated) {
                        this.my_trades[r1][r2].splice(i, 1);
                    }
                }
            }
        }
    }

    makeRandomTrades() {
        let sumTradesAttempted = 0;
        let sumTradesAccepted = 0;

        for (let r1 = 0; r1 < PARAMS.numResources; r1++) {
            for (let r2 = 0; r2 < PARAMS.numResources; r2++) {
                if (r1 === r2) continue;

                for (let trade_info of shuffleArray(this.my_trades[r1][r2])) {
                    const trade = trade_info.trade;
                    const side = trade_info.side;
                    const rIn = trade.resourcesIn[side];
                    assert(rIn === r1, `resources ${rIn} and ${r1} are mixed up`);
                    const rOut = trade.resourceInOppositeSide(side);

                    const amountInAttempted = 1;
                    if (this.favorsTrade(trade, side, rIn, rOut) && this.canAffordTrade(rIn, amountInAttempted)) {
                        sumTradesAttempted += 1;
                        let traded = trade.invoke(this, side, amountInAttempted);
                        sumTradesAccepted += traded;
                    }
                }
            }
        }

        return {sumTradesAttempted, sumTradesAccepted};
    }

    favorsTrade(trade, side, rIn, rOut) {
        const XinXout = trade.XinXout[side];
        return (this.resource_valuations[rOut] / this.resource_valuations[rIn] >= XinXout);
    }

    canAffordTrade(rIn, amountInAttempted) {
        if (rIn < PARAMS.numResources) {
            return this.supply[rIn] >= amountInAttempted;
        } else {
            return this.alternativeSupply[rIn - PARAMS.numResources] >= amountInAttempted;
        }
    }
}
