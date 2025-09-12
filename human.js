
class Human {
    static lastHumanId = 0;
    constructor(options = {}) {
        const defaults = {
            id: Human.lastHumanId + 1,
            energy: PARAMS.initialEnergy,
            x: randomInt(PARAMS.width),
            y: randomInt(PARAMS.height),
            reach: sampleRightSkew(.01),
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
        this.productivity = randomFloat(0, 1);
        this.location = {x: 0, y: 0};
        
        // this.energy = energy;
        this.metabolism = Array(PARAMS.numResources).fill(energy / PARAMS.numResources);
        this.maxEnergyPerResource = PARAMS.maxHumanEnergy / PARAMS.numResources;
        this.supply = Array(PARAMS.numResources).fill(0);
        this.alternativeSupply = Array(PARAMS.numAlternativeResources).fill(0);

        // Trading-related
        this.personal_valuation_factor = generateNormalSample(1, .1);
        this.my_trades = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill([]);
        this.resource_valuations = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(1);
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
        this.trade();

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
        ctx.arc(this.x, this.y, 5, 0, 2 * Math.PI); // radius 5 for a small dot
        ctx.fill();
        ctx.closePath(); 

        // Social reach circle (only if toggled on)
        if (PARAMS.show_social_reach) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.socialReach, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.closePath();

            if (this.isSpawning) {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.socialReach, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.closePath();
            }
        }

            // Human ID label
         ctx.font = "12px monospace";
        ctx.textBaseline = "middle";
        ctx.fillText(`H${this.id}`, this.x + 8, this.y); // small offset to the right
    }

    work() {
        this.produce();
    }

    
    produce() {
        for (let r = 0; r < PARAMS.numResources; r++) {
            const resourceConcentration = this.forest.getConcentration(this.x, this.y, r);
            this.supply[r] += generateNormalSample(this.productivity * Math.pow(resourceConcentration, 3), resourceConcentration*.1) * 1;
        }
        this.spendEnergy(PARAMS.workEnergyCost);
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
            const resource = Math.min(this.supply[r], .4);
            this.supply[r] -= resource;

            // newEnergy += ingrediant * (deficit/PARAMS.numResources);
            this.metabolism[r] += resource * deficit;
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



    trade() {
        this.updateResourceValuations();

        for (let r = 0; r < PARAMS.numResources + PARAMS.numAlternativeResources; r++) {
            for (let trade_info of this.my_trades[r]) {
                if (this.favorsTrade(trade_info, r) && this.canAffordTrade(trade_info, r)) {
                    // todo: change to a loop, for as long as can afford trade in this cycle
                    this.executeTrade(trade);
                }
            }
        }
    }

    updateResourceValuations() {
        for (let r = 0; r < PARAMS.numResources; r++) {
            this.resource_valuations[r] = this.maxEnergyPerResource - this.metabolism[r] * this.personal_valuation_factor;
            
        }


        // labor is fixed at value 1, for now
        //
        // for (let r = 0; r < PARAMS.numAlternativeResources; r++) {
        //     // const deficit = 0;
        //     this.resource_valuations[PARAMS.numResources + r] = 1; // placeholder
            
        // }
    }


    favorsTrade(trade_info, r) {
        // "in" refers to "in"put of trade, i.e. what this human is giving away
        const inResourceQuantity = trade_info.trade.inResourceQuantity[trade_info.side];
        const outResourceQuantity = trade_info.trade.outResourceQuantity[trade_info.side];
        return (this.resource_valuations[r] * inResourceQuantity < this.resource_valuations[r] * outResourceQuantity);
    }
    
    canAffordTrade(trade_info, r) {
        const inResourceQuantity = trade_info.trade.inResourceQuantity[trade_info.side];
        if (r < PARAMS.numResources) {
            return this.supply[r] >= inResourceQuantity;
        } else {
            return this.alternativeSupply[r - PARAMS.numResources] >= inResourceQuantity;
        }
    }

    executeTrade(trade_info, r) {

    }

    
    
    
    // payIntoPot() {
        
    // }
    
    // reproduce() {

    // }

}
