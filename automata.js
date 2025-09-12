


class Automata {
    constructor() {
        gameEngine.automata = this;
        gameEngine.addEntity(this);
        this.generation = 0;
        this.forest = new Forest();
        this.humans = [];
        const datamanager = new DataManager(this);
        gameEngine.addEntity(datamanager);
        this.datamanager = datamanager;

        for (let i = 0; i < PARAMS.initialHumans; i++) {
            // this.add_human(new Human({age: randomInt(PARAMS.maxHumanAge || 100), id: lastHumanId++}));
            this.add_human(new Human());
        }
    }

    add_human(human) {
        this.humans.push(human);
    }

    add_human_at(x, y) {
        const human = new Human({x: x, y: y});
        this.add_human(human); // add to the simulation
    }


    update() {
        this.generation++;
        this.forest.update();

        for (let human of this.humans) {
            human.update();
        }

        for (let i = this.humans.length - 1; i >= 0; --i) {
            if (this.humans[i].removeFromWorld) {
                this.humans.splice(i, 1);
            }
        }
    }

  
    draw(ctx) {
        this.forest.draw(ctx);
        for (let human of this.humans) {
            human.draw(ctx);
        }

//        ctx.restore();
      
    }
}
