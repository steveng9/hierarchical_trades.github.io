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
            // The default 'uniform' population mechanic returns null, so `Human` draws its
            // own position exactly as before — RNG stream and goldens untouched.
            const placement = sim.mechanics.population.place(i, sim);
            this.addHuman(this.createHuman(placement ? {x: placement.x, y: placement.y} : {}));
        }

        // Exists under every exchange mechanic so probes and views that read `trades` see an
        // empty list rather than crash; only the `postedTrades` engine ever updates it.
        this.trademanager = new TradeManager(sim);

        // The trading step. Constructed after the founders so it can wire them (pairwise
        // exchange builds its network here); the historical engine consumes no RNG doing so.
        this.exchange = sim.mechanics.exchange.create(sim, this);
        this.exchange.initialize(this.humans);
    }

    createHuman(options = {}) {
        return new Human(this.sim, options);
    }

    addHuman(human) {
        this.humans.push(human);
        this.humanById.set(human.id, human);
        this.grid.insert(human);
        // Undefined only while the founders are being created; `initialize` covers them.
        this.exchange?.onHumanAdded(human);
    }

    addHumanAt(x, y) {
        const human = this.createHuman({x, y});
        this.addHuman(human);
        return human;
    }

    /** Everyone inside `human`'s social reach, including `human` itself. */
    humansWithinReach(human) {
        const result = this.grid.query(human.x, human.y, human.socialReach, this.wrapDims());
        result.sort((a, b) => a.id - b.id);
        return result;
    }

    /** World dimensions for toroidal distance, or null when `wrapped` is off. */
    wrapDims() {
        if (!this.sim.params.wrapped) return null;
        return {width: this.sim.params.forestwidth, height: this.sim.params.forestheight};
    }

    /**
     * Every unit of resource `r` held anywhere: by agents, or by the exchange engine (trade
     * escrow and pooled trade supply, under posted trades). The left-hand side of the
     * conservation check.
     */
    sumAllResources(r) {
        let sum = 0;
        for (const human of this.humans) sum += human.supply[r];
        return this.exchange.accumulateHeld(r, sum);
    }

    update() {
        this.forest.update();

        for (const human of this.humans) human.update();
        this.reapDead();
        this.exchange.update();
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
            this.exchange.onHumanRemoved(human);
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
