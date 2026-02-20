
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
        
        // Merge defaults with overrides
        const {id, energy, reach, isSpawning, x, y} = { ...defaults, ...options };

        this.x = x;
        this.y = y;
        this.id = id;
        this.forest = gameEngine.automata.forest;
        Human.lastHumanId = id;
        this.removeFromWorld = false;
        this.isSpawning = isSpawning;
        
        this.age = 0;
        this.maxAge = generateNormalSample(PARAMS.maxHumanAge, PARAMS.maxHumanAge/20);
        this.socialReach = reach;
        this.productivity = randomFloat(0, 1.2);
        // this.productivity = .7;
        // this.production_potential = this.calculate_production_potential();
        this.num_trades_built = 0;
        // this.trades_built = Array.from({ length: PARAMS.numResources }, () => Array(PARAMS.numResources).fill(null));
        this.trades_built = Array.from({ length: PARAMS.numResources }, () =>
            Array.from({ length: PARAMS.numResources }, () => null)
        );
        
        // this.energy = energy;
        this.metabolism = Array(PARAMS.numResources).fill(energy / PARAMS.numResources);
        this.maxEnergyPerResource = PARAMS.maxHumanEnergy / PARAMS.numResources;
        this.supply = Array(PARAMS.numResources).fill(0);
        this.alternativeSupply = Array(PARAMS.numAlternativeResources).fill(0);
        
        // Trading-related
        // this.personal_valuation_factor = generateNormalSample(1, .1);
        this.personal_valuation_factor = 1;
        // this.my_trades = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill([]);
        // this.my_trades = [];
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

        // work
        this.work();

        // interact with other humans
        // this.trade();

        this.eat();

        // reproduce
    }

  
    draw(ctx) {

        if (this.isSpawning) {
            ctx.fillStyle = "yellow";
            ctx.strokeStyle = "yellow";
        } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#FFFFFF";
        }

        // point of location
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.forest.x + this.x, this.forest.y + this.y, 5, 0, 2 * Math.PI); // radius 5 for a small dot
        ctx.fill();
        ctx.closePath(); 

        // Social reach circle (only if toggled on)
        if (PARAMS.show_social_reach) {
            ctx.beginPath();
            ctx.arc(this.forest.x + this.x, this.forest.y + this.y, this.socialReach, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.closePath();

            if (this.isSpawning) {
                ctx.beginPath();
                ctx.arc(this.forest.x + this.x, this.forest.y + this.y, this.socialReach, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.closePath();
            }
        }

            // Human ID label
         ctx.font = "12px monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(`H${this.id}`, this.forest.x + this.x + 8, this.forest.y + this.y); // small offset to the right
    }

    calculate_production_potential() {
        const sum_resources_here = [...Array(PARAMS.numResources).keys()].reduce((acc, r) => acc + this.forest.getConcentration(this.x, this.y, r), 0);
        return this.productivity * sum_resources_here;
    }

    work() {
        const production_potential = this.calculate_production_potential(); // in theory, this could change every update, if the map changes, or if I change the threshold for some reason, based on the market.
        this.is_laborer = production_potential < PARAMS.production_labor_threshold;
        // this.produce();
        // console.log(production_potential, PARAMS.production_labor_threshold);
        if (this.is_laborer && !this.critically_hungry()) this.labor();
        else this.produce();
    }

    critically_hungry() {
        return this.total_energy() < PARAMS.maxHumanEnergy / 10;
    }


    
    produce() {
        for (let r = 0; r < PARAMS.numResources; r++) {
            const resourceConcentration = this.forest.getConcentration(this.x, this.y, r);
            const produced = generateNormalSample(this.productivity * Math.pow(resourceConcentration, 3), resourceConcentration*.1) * 1;
            // const produced = this.productivity * Math.pow(resourceConcentration, 5);
            // const produced = this.productivity * 2* (Math.max(resourceConcentration, .5) - .5);
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
    //
    buildTrades() {
        let anyTradesBuilt = false;
        const humansWithinReach = this.humansWithinReach();
        if (humansWithinReach.length <= 1) return false;
        for (let [r1, r2] of shuffleArray(gameEngine.automata.trademanager.all_resource_pairs)) {
            const value_ratios = [];
            let ave_trades_already_available = 0;
            for (let human of humansWithinReach) {
                value_ratios.push(human.resource_valuations[r1] / human.resource_valuations[r2]);
                ave_trades_already_available += human.my_trades[r1][r2].length;
                assert(human.my_trades[r1][r2].length === human.my_trades[r2][r1].length, `${human.my_trades[r1][r2].length} != ${human.my_trades[r2][r1].length}...trades are always given to humans in pairs! If they have one 'side' of the trade, then they should have the other, always.`);
            }
            ave_trades_already_available /= humansWithinReach.length;


            const distribution = meanAndStd(value_ratios);
            const trade_points_distance_from_mean = Math.max(Math.min(distribution.std * PARAMS.surplus_multiplier, distribution.mean/2), .000001);
            assert(trade_points_distance_from_mean >= 0, `weird: ${trade_points_distance_from_mean}`);
            // todo: update this variable to be correct
            const newTradeSurplus_R2 = 2 * trade_points_distance_from_mean;
            // todo: update this variable to be correct
            const expected_volume = newTradeSurplus_R2 * humansWithinReach.length * PARAMS.expected_volume_multiplier / (ave_trades_already_available**3 + 1);
            // todo: update this variable to be correct
            const cost_to_establish = Math.pow(this.socialReach, 1/2) * PARAMS.build_labor_per_reach;
            const r1_in = 1;
            const r1_out = 1;
            const r2_in = distribution.mean + trade_points_distance_from_mean;
            const r2_out = distribution.mean - trade_points_distance_from_mean;

            if (cost_to_establish <= this.alternativeSupply[0] &&
                expected_volume > cost_to_establish
                && r1_in / r2_out <= r2_in / r1_out
            ) {
                // console.log(`volume: ${expected_volume.toFixed(2)}, cost: ${cost_to_establish.toFixed(2)}, labor reserved ${this.alternativeSupply[0]}`)
                anyTradesBuilt = true;

                const newTrade = new Trade(r1, r2, r1_in, r2_out, r2_in, r1_out, this);
                this.num_trades_built += 1;

                // // only do this if replace new trades.
                // if (this.trades_built[r1][r2]) {
                //     this.trades_built[r1][r2].deprecated = true;
                // }
                // this.trades_built[r1][r2] = newTrade;

                // assert(r1_in / r2_out <= r2_in / r1_out + Number.EPSILON*10, `${(r1_in / r2_out).toFixed(2)}, ${(r1_in / r2_out).toFixed(2)}`);
                // console.log(`new trade: IN ${r1}, OUT ${r2}, Ain: ${r1_in}, Bout: ${r1_out}, Bin: ${r2_in}, Aout: ${r1_out}`)
                gameEngine.automata.trademanager.trades.push(newTrade);
                gameEngine.automata.trademanager.total_trades_made += 1;
                for (let human of humansWithinReach) {
                    human.my_trades[r1][r2].push({trade: newTrade, side: 'A'});
                    human.my_trades[r2][r1].push({trade: newTrade, side: 'B'});
                }
                this.alternativeSupply[0] -= cost_to_establish;
                break; // only create one trade per turn?
            }
        }
        return anyTradesBuilt;
    }

    buildMultiLevelTrades() {
        let anyTradesBuilt = false;
        const humansWithinReach = this.humansWithinReach();
        if (humansWithinReach.length <= 1) return false;
        if (this.alternativeSupply[0] <= .0001) return false; // doesn't have any labor to create a trade


        for (let [r1, r2] of shuffleArray(gameEngine.automata.trademanager.all_resource_pairs_with_labor)) {
            const value_ratios = [];
            let ave_trades_already_available = 0;
            for (let human of humansWithinReach) {
                value_ratios.push(human.resource_valuations[r1] / human.resource_valuations[r2]);
                ave_trades_already_available += human.my_trades[r1][r2].length;
                assert(human.my_trades[r1][r2].length === human.my_trades[r2][r1].length, `${human.my_trades[r1][r2].length} != ${human.my_trades[r2][r1].length}...trades are always given to humans in pairs! If they have one 'side' of the trade, then they should have the other, always.`);
            }
            ave_trades_already_available /= humansWithinReach.length;


            const distribution = meanAndStd(value_ratios);
            const trade_points_distance_from_mean = Math.max(Math.min(distribution.std * PARAMS.surplus_multiplier, distribution.mean/2), .000001);
            assert(trade_points_distance_from_mean >= 0, `weird: ${trade_points_distance_from_mean}`);
            // todo: update this variable to be correct
            const newTradeSurplus_R2 = 2 * trade_points_distance_from_mean;
            // todo: update this variable to be correct
            const expected_volume = newTradeSurplus_R2 * humansWithinReach.length * PARAMS.expected_volume_multiplier / (ave_trades_already_available**3 + 1);
            // todo: update this variable to be correct
            const cost_to_establish = Math.pow(this.socialReach, 1/2) * PARAMS.build_labor_per_reach;
            const r1_in = 1;
            const r1_out = 1;
            const r2_in = distribution.mean + trade_points_distance_from_mean;
            const r2_out = distribution.mean - trade_points_distance_from_mean;

            if (cost_to_establish <= this.alternativeSupply[0] &&
                expected_volume > cost_to_establish
                && r1_in / r2_out <= r2_in / r1_out
            ) {
                // console.log(`volume: ${expected_volume.toFixed(2)}, cost: ${cost_to_establish.toFixed(2)}, labor reserved ${this.alternativeSupply[0]}`)
                anyTradesBuilt = true;

                const newTrade = new Trade(r1, r2, r1_in, r2_out, r2_in, r1_out, this);
                this.num_trades_built += 1;

                // // only do this if replace new trades.
                // if (this.trades_built[r1][r2]) {
                //     this.trades_built[r1][r2].deprecated = true;
                // }
                // this.trades_built[r1][r2] = newTrade;

                // assert(r1_in / r2_out <= r2_in / r1_out + Number.EPSILON*10, `${(r1_in / r2_out).toFixed(2)}, ${(r1_in / r2_out).toFixed(2)}`);
                // console.log(`new trade: IN ${r1}, OUT ${r2}, Ain: ${r1_in}, Bout: ${r1_out}, Bin: ${r2_in}, Aout: ${r1_out}`)
                gameEngine.automata.trademanager.trades.push(newTrade);
                gameEngine.automata.trademanager.total_trades_made += 1;
                for (let human of humansWithinReach) {
                    human.my_trades[r1][r2].push({trade: newTrade, side: 'A'});
                    human.my_trades[r2][r1].push({trade: newTrade, side: 'B'});
                }
                this.alternativeSupply[0] -= cost_to_establish;
                break; // only create one trade per turn?
            }
        }
        return anyTradesBuilt;
    }

    humansWithinReach() {
        // todo: make a premade list, and only update it when human is born or dies, instead of every cycle.
        const humansWithinReach = [];
        for (let human of gameEngine.automata.humans) {
            if (distance(human, this) < this.socialReach) {
                humansWithinReach.push(human);
            }
        }
        return humansWithinReach;
    }




    // keepOrder() {
        
    // }

    // steal() {
        
    // }
    
    eat() {
        // this.energy += this.metabolize();
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
        // return newEnergy;
    }

    spendEnergy(amount) {
        const total_energy = this.total_energy();
        if (total_energy <= 0) return;
        for (let r = 0; r < PARAMS.numResources; r++) {
            const metabolized = this.metabolism[r];
            this.metabolism[r] -= amount * (metabolized / total_energy);
            // if (this.metabolism[r] < 0) this.metabolism[r] = 0;
        }
    }


    updateResourceValuations() {
        for (let r = 0; r < PARAMS.numResources; r++) {
            // this.resource_valuations[r] = (this.maxEnergyPerResource - this.metabolism[r]) * this.personal_valuation_factor;
            // this.resource_valuations[r] = 10 / this.supply[r];
            this.resource_valuations[r] = Math.pow((this.maxEnergyPerResource - this.metabolism[r]) / (this.supply[r] + 1), 1/2);
            if (!this.resource_valuations[r]) this.resource_valuations[r] = 1;
            
        }

        // clear unused trades
        for (let r1 = 0; r1 < PARAMS.numResources; r1++) {
            for (let r2 = 0; r2 < PARAMS.numResources; r2++) {

                for (let i = this.my_trades[r1][r2].length - 1; i >= 0; i--) {
                    const trade = this.my_trades[r1][r2][i].trade;
                    if (trade.deprecated) {
                        this.my_trades[r1][r2].splice(i, 1);
                    }
                }
            }
        }


        // labor is fixed at value 1, for now
        //
        // for (let r = 0; r < PARAMS.numAlternativeResources; r++) {
        //     // const deficit = 0;
        //     this.resource_valuations[PARAMS.numResources + r] = 1; // placeholder
            
        // }
    }

    
    makeRandomTrades() {
        // this.updateResourceValuations();

        // for (let r = 0; r < PARAMS.numResources + PARAMS.numAlternativeResources; r++) {
            // for (let trade_info of this.my_trades[r]) {
        let sumTradesAttempted = 0;
        let sumTradesAccepted = 0;

        for (let r1 = 0; r1 < PARAMS.numResources; r1++) {
            for (let r2 = 0; r2 < PARAMS.numResources; r2++) {
                if (r1 === r2) continue;

                const trades_for_r1_r2 = this.my_trades[r1][r2];
                for (let trade_info of shuffleArray(trades_for_r1_r2)) {
                    const trade = trade_info.trade;
                    const side = trade_info.side;
                    const rIn = trade.resourcesIn[side];
                    assert(rIn === r1, `the resources ${rIn} and ${r1} are mixed up!`);
                    const rOut = trade.resourceInOppositeSide(side);

                    // const amountInAttempted = trade_info.trade.inResourceQuantity[trade_info.side];
                    const amountInAttempted = 1;
                    if (this.favorsTrade(trade, side, rIn, rOut) && this.canAffordTrade(rIn, amountInAttempted)) {

                        // todo: change to a loop, for as long as can afford trade in this cycle

                        // todo: change trade quantity based on current supply and/or valuations.
                        sumTradesAttempted += 1;
                        // console.log(this.id, rIn, this.supply);
                        // console.log(rIn, trade.resourcesIn);
                        let traded = trade.invoke(this, side, amountInAttempted);
                        sumTradesAccepted += traded;

                    }

                }
            }
        }

        return {sumTradesAttempted, sumTradesAccepted};
    }

    //
    // makeOnlyFavorableTrades() {
    //     // this.updateResourceValuations();
    //
    //     // for (let r = 0; r < PARAMS.numResources + PARAMS.numAlternativeResources; r++) {
    //         // for (let trade_info of this.my_trades[r]) {
    //     let sumTradesAttempted = 0;
    //     let sumTradesAccepted = 0;
    //
    //     const best_trades = Array.from({ length: PARAMS.numResources }, () => Array(PARAMS.numResources).fill(null));
    //     const best_trade_values = Array.from({ length: PARAMS.numResources }, () => Array(PARAMS.numResources).fill(Number.MAX_VALUE));
    //     for (let trade_info of shuffleArray(this.my_trades)) {
    //         const trade = trade_info.trade;
    //         const side = trade_info.side;
    //         const rIn = trade.resourcesIn[side];
    //         const rOut = trade.resourceInOppositeSide(side);
    //
    //         if (trade.XinXout[side] < best_trade_values[rIn][rOut]) {
    //             best_trades[rIn][rOut] = trade_info;
    //             best_trade_values[rIn][rOut] = trade.XinXout[side];
    //         }
    //
    //     }
    //
    //     for (let rIn = 0; rIn < PARAMS.numResources; rIn++) {
    //         for (let rOut = 0; rOut < PARAMS.numResources; rOut++) {
    //             if (rIn == rOut || !best_trades[rIn][rOut]) continue;
    //             const trade = best_trades[rIn][rOut].trade;
    //             const side = best_trades[rIn][rOut].side;
    //             // const amountInAttempted = trade_info.trade.inResourceQuantity[trade_info.side];
    //             const amountInAttempted = 1;
    //             if (this.favorsTrade(trade, side, rIn, rOut) && this.canAffordTrade(rIn, amountInAttempted)) {
    //
    //                 // todo: change to a loop, for as long as can afford trade in this cycle
    //
    //                 // todo: change trade quantity based on current supply and/or valuations.
    //                 sumTradesAttempted += 1;
    //                 // console.log(this.id, rIn, this.supply);
    //                 // console.log(rIn, trade.resourcesIn);
    //                 let traded = trade.invoke(this, side, amountInAttempted);
    //                 sumTradesAccepted += traded;
    //
    //             }
    //         }
    //     }
    //
    //     return {sumTradesAttempted, sumTradesAccepted};
    // }



    favorsTrade(trade, side, rIn, rOut) {
        // "in" refers to "in"put of trade, i.e. what this human is giving away
        const XinXout = trade.XinXout[side];

        // const inResourceQuantity = trade_info.trade.inResourceQuantity[trade_info.side];
        // const outResourceQuantity = trade_info.trade.outResourceQuantity[trade_info.side];
        return (this.resource_valuations[rOut] / this.resource_valuations[rIn] >= XinXout);
    }
    
    canAffordTrade(rIn, amountInAttempted) {
        if (rIn < PARAMS.numResources) {
            return this.supply[rIn] >= amountInAttempted;
        } else {
            return this.alternativeSupply[rIn - PARAMS.numResources] >= amountInAttempted;
        }
    }

    // executeTrade(trade, side, quantity) {
    //     trade.invoke(this, side, quantity);
    // }

    
    
    
    // payIntoPot() {
        
    // }
    
    // reproduce() {

    // }

}
