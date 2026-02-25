


class Automata {
    constructor() {
        gameEngine.automata = this;
        gameEngine.addEntity(this);
        this.generation = 0;
        this.totalBirths = 0;
        this.forest = new Forest();
        this.humans = [];
        this.humanById = new Map();
        const datamanager = new DataManager(this);
        gameEngine.addEntity(datamanager);
        this.datamanager = datamanager;

        for (let i = 0; i < PARAMS.initialHumans; i++) {
            // this.add_human(new Human({age: randomInt(PARAMS.maxHumanAge || 100), id: lastHumanId++}));
            this.add_human(new Human());
        }

        this.trademanager = new TradeManager(this);
    }

    add_human(human) {
        this.humans.push(human);
        this.humanById.set(human.id, human);
    }

    add_human_at(x, y) {
        const human = new Human({x: x, y: y});
        this.add_human(human); // add to the simulation
    }

    sum_all_resources(r) {
        let sum = 0;
        for (let human of this.humans) {
            sum += human.supply[r];
        }
        for (let trade of this.trademanager.trades) {
            sum += trade.escrow[r];
            sum += trade.supply[r];
        }
        return sum;
    }


    update() {
        this.generation++;
        this.forest.update();

        for (let human of this.humans) {
            human.update();
        }

        for (let i = this.humans.length - 1; i >= 0; --i) {
            if (this.humans[i].removeFromWorld) {
                const dying = this.humans[i];
                for (let r = 0; r < PARAMS.numResources; r++) {
                    gameEngine.total_lost[r] += dying.supply[r];
                }
                this.humanById.delete(dying.id);
                this.humans.splice(i, 1);
            }
        }

        this.trademanager.update();
    }

  
    draw(ctx) {
        this.forest.draw(ctx);
        for (let human of this.humans) {
            human.draw(ctx);
        }

//        ctx.restore();
      
    }
}
