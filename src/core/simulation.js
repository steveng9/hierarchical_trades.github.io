/**
 * The simulation root.
 *
 * Owns the RNG, the resolved parameters, the mechanics selection, the ledger, the event
 * bus, and the world. Everything downstream reaches its dependencies through this object
 * rather than through globals — which is what makes it possible to run several independent
 * simulations in one process, as a parameter sweep does.
 *
 * Contains no rendering, no DOM, and no timing. `step()` advances exactly one tick and is
 * the only way the world moves.
 *
 * @example
 *   const sim = new Simulation({params: {seed: 7, initialHumans: 200}});
 *   sim.run(1000);
 *   console.log(sim.world.population, sim.world.trademanager.maxActiveLevel());
 */
import {Random} from './rng.js';
import {IdAllocator} from './ids.js';
import {Ledger} from './ledger.js';
import {EventBus} from './events.js';
import {World} from './world.js';
import {resolveParams, paramsFingerprint} from './params.js';
import {resolveMechanics} from '../mechanics/registry.js';
import {hashWorldState} from './statehash.js';

export class Simulation {
    /**
     * @param {Object} [config]
     * @param {Object} [config.params]     parameter overrides; validated against the schema
     * @param {Object} [config.mechanics]  mechanic -> variant name
     * @param {string} [config.terrain]    terrain generator (overrides mechanics.terrain)
     * @param {boolean} [config.strictParams=true]  reject unknown parameter keys
     * @param {boolean} [config.clampRanges=false] clamp out-of-range values instead of throwing
     */
    constructor(config = {}) {
        this.params = resolveParams(config.params ?? {}, {
            strict: config.strictParams !== false,
            clampRanges: config.clampRanges === true,
        });
        this.mechanics = resolveMechanics(config.mechanics ?? {});
        this.paramsFingerprint = paramsFingerprint(this.params);

        this.rng = new Random(this.params.seed);
        // Trades were historically 0-based and humans 1-based; ids appear in state hashes.
        this.ids = new IdAllocator({human: 1, trade: 0});
        this.events = new EventBus();
        this.ledger = new Ledger(this.params.numResources + this.params.numAlternativeResources);

        this.tick = 0;
        this.startedAt = null;
        this.finishedAt = null;

        const terrain = config.terrain ?? this.mechanics.names.terrain;
        this.world = new World(this, {terrain});
    }

    /** Advance exactly one tick. */
    step() {
        this.tick++;
        this.world.update();
    }

    /**
     * Advance `ticks` ticks.
     *
     * @param {number} ticks
     * @param {Object} [options]
     * @param {(sim: Simulation) => void} [options.onTick]   called after each tick
     * @param {(sim: Simulation) => boolean} [options.until] stop early when it returns true
     * @returns {Simulation} this
     */
    run(ticks, options = {}) {
        const {onTick, until} = options;
        if (this.startedAt === null) this.startedAt = Date.now();

        for (let i = 0; i < ticks; i++) {
            this.step();
            if (onTick) onTick(this);
            if (until && until(this)) break;
        }
        this.finishedAt = Date.now();
        return this;
    }

    /** Digest of the full world state. Identical seeds and parameters must agree. */
    hashState() {
        return hashWorldState(this.tick, this.world.humans, this.world.trademanager.trades);
    }

    /** Conservation check across every tradeable resource. */
    checkConservation(tolerance = 1e-6) {
        const results = [];
        for (let r = 0; r < this.params.numResources; r++) {
            results.push(this.ledger.checkConservation(this.world, r, tolerance));
        }
        return results;
    }

    /** Compact summary for logging and run records. */
    summary() {
        const tm = this.world.trademanager;
        return {
            tick: this.tick,
            seed: this.params.seed,
            paramsFingerprint: this.paramsFingerprint,
            mechanics: this.mechanics.names,
            population: this.world.population,
            totalBirths: this.world.totalBirths,
            totalDeaths: this.world.totalDeaths,
            activeTrades: tm.trades.length,
            totalTradesBuilt: tm.total_trades_made,
            tradesByLevel: {...tm.totalTradesByLevel},
            activeByLevel: tm.activeCountsByLevel(),
            maxActiveLevel: tm.maxActiveLevel(),
            rngDraws: this.rng.drawCount,
            stateHash: this.hashState(),
            wallMs: this.finishedAt && this.startedAt ? this.finishedAt - this.startedAt : null,
        };
    }
}
