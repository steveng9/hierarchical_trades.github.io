/**
 * The world: the forest, the population, and the trade system.
 *
 * Was `Automata`, minus the view construction that used to happen in its constructor.
 * Rendering and measurement now attach from outside, which is what lets the same world run
 * headless in a sweep and interactively in a browser without divergence.
 */
import {Forest} from './forest.js';
import {Human} from './human.js';
import {TradeManager} from './trademanager.js';
import {EVENTS} from './events.js';
import {SpatialGrid} from './spatialgrid.js';

export class World {
    constructor(sim, {terrain = 'wavy'} = {}) {
        this.sim = sim;
        this.totalBirths = 0;
        this.totalDeaths = 0;

        // Construction order is RNG-significant: the forest draws its noise seeds before
        // any agent is created.
        this.forest = new Forest(sim, terrain);

        this.grid = new SpatialGrid(sim.params.forestwidth, sim.params.forestheight, 50);

        this.humans = [];
        this.humanById = new Map();
        for (let i = 0; i < sim.params.initialHumans; i++) {
            this.addHuman(this.createHuman());
        }

        this.trademanager = new TradeManager(sim);
    }

    createHuman(options = {}) {
        return new Human(this.sim, options);
    }

    addHuman(human) {
        this.humans.push(human);
        this.humanById.set(human.id, human);
        this.grid.insert(human);
    }

    addHumanAt(x, y) {
        const human = this.createHuman({x, y});
        this.addHuman(human);
        return human;
    }

    /** Everyone inside `human`'s social reach, including `human` itself. */
    humansWithinReach(human) {
        const result = this.grid.query(human.x, human.y, human.socialReach);
        result.sort((a, b) => a.id - b.id);
        return result;
    }

    /**
     * Every unit of resource `r` held anywhere: by agents, in trade escrow, or pooled as
     * trade supply. The left-hand side of the conservation check.
     */
    sumAllResources(r) {
        let sum = 0;
        for (const human of this.humans) sum += human.supply[r];
        for (const trade of this.trademanager.trades) {
            sum += trade.escrow[r];
            sum += trade.supply[r];
        }
        return sum;
    }

    update() {
        this.forest.update();

        for (const human of this.humans) human.update();
        this.reapDead();
        this.trademanager.update();
    }

    /** Remove the dead, writing off whatever they were holding. */
    reapDead() {
        for (let i = this.humans.length - 1; i >= 0; i--) {
            const human = this.humans[i];
            if (!human.removeFromWorld) continue;

            for (let r = 0; r < this.sim.params.numResources; r++) {
                this.sim.ledger.recordLost(r, human.supply[r]);
            }
            this.grid.remove(human);
            this.humanById.delete(human.id);
            this.humans.splice(i, 1);
            this.totalDeaths++;
            this.sim.events.emit(EVENTS.HUMAN_DIED, {human, tick: this.sim.tick});
        }
    }

    get population() {
        return this.humans.length;
    }
}
