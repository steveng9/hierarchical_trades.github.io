/**
 * A trade: a posted exchange rate between two resources, invocable by any agent that can
 * see it. Level-1 trades are norms among agents. Level-2+ trades are norms *about* norms —
 * one of their two sides is backed by a lower-level trade's accumulated surplus rather than
 * by another agent.
 *
 * The mechanism is inductive: a `Trade` and a `Human` are interchangeable as counterparties
 * because both expose `supply[]`. Nothing in this file special-cases a level.
 *
 * ## Sides
 *
 * A and B are the two concrete sides, not specific resources: an agent either gives `Ain`
 * and receives `Aout`, or gives `Bin` and receives `Bout`. X and Y are variables over
 * sides. For a hierarchical trade, `parentSide` is the side supplied by the parent trade;
 * the other side (`agentSide()`) faces agents.
 */
import {assert} from './assert.js';
import {distance} from './mathutil.js';
import {EVENTS} from './events.js';

export class Trade {
    /**
     * @param {import('./simulation.js').Simulation} sim
     * @param {number} resourceA  resource index entering on side A
     * @param {number} resourceB  resource index entering on side B
     * @param {Trade|null} parentTrade  lower-level trade backing one side (null = level-1)
     * @param {'A'|'B'|null} parentSide which side the parent supplies
     */
    constructor(sim, resourceA, resourceB, Ain, Aout, Bin, Bout, inventor, parentTrade = null, parentSide = null) {
        assert(Ain >= Bout && Bin >= Aout,
            `Trade must have non-negative surplus: Ain ${Ain.toFixed(2)}, Aout ${Aout.toFixed(2)}, Bin ${Bin.toFixed(2)}, Bout ${Bout.toFixed(2)}`,
            {Ain, Aout, Bin, Bout});

        this.sim = sim;
        this.id = sim.ids.next('trade');
        this.inventor = inventor;
        this.birthTick = sim.tick;
        this.deathTick = null;

        this.resourcesIn = {A: resourceA, B: resourceB};
        this.laborRequired = (Ain + Bin) * sim.params.laborPerResourceUnit;
        this.invocations = {A: 0, B: 0};
        this.invocations_since_last_checked = {A: 0, B: 0};
        this.volumeMoved = {A: 0, B: 0};

        // Precomputed exchange ratios, keyed by side.
        this.XinXout = {A: Ain / Aout, B: Bin / Bout};
        this.YinXout = {A: Bin / Aout, B: Ain / Bout};
        this.XinYin  = {A: Ain / Bin,  B: Bin / Ain};

        // Fractional spread captured on each side. The inventor's margin.
        this.surpluses = {A: (Ain - Bout) / Ain, B: (Bin - Aout) / Bin};

        const totalResources = sim.params.numResources + sim.params.numAlternativeResources;
        this.supply = Array(totalResources).fill(0);
        this.labor = 0;
        this.escrow = Array(totalResources).fill(0);
        this.requests = {A: [], B: []};
        this.deprecated = false;
        this.deprecationCause = null;

        this.trade_partners = new Map();

        // Hierarchy
        this.parentTrade = parentTrade;
        this.parentSide = parentSide;
        this.level = parentTrade ? parentTrade.level + 1 : 1;
        this.managers = new Set();
        this.invokers = new Map();      // human -> last-invoked tick (agent side only)
        this.newManagers = [];          // queued for batched reach propagation
        this.childTrades = [];
    }

    get isHierarchical() {
        return this.parentTrade !== null;
    }

    /** The agent-facing side of a hierarchical trade. Null for level-1 (both sides face agents). */
    agentSide() {
        if (!this.isHierarchical) return null;
        return oppositeSide(this.parentSide);
    }

    invoke(human, side, quantity) {
        return this.isHierarchical
            ? this.invokeHierarchical(human, side, quantity)
            : this.invokeLevel1(human, side, quantity);
    }

    /**
     * Level-1: both sides are agent-driven. Unmatched offers rest in escrow until a
     * counterparty arrives within the same tick; `clearEscrow` refunds the remainder.
     */
    invokeLevel1(human, side, quantity) {
        this.invocations[side] += 1;
        this.invocations_since_last_checked[side] += 1;

        const resourceOut = this.resourceInOppositeSide(side);
        const resourceIn = this.resourcesIn[side];
        const desiredOut = quantity / this.XinXout[side];

        // Escrow can drift microscopically negative through repeated subtraction.
        if (this.escrow[resourceOut] < 0) this.escrow[resourceOut] = 0;

        const availableOut = this.escrow[resourceOut] / this.YinXout[side];
        const fulfilledOut = Math.min(availableOut, desiredOut);
        assert(fulfilledOut >= 0,
            `fulfilledOut should be >= 0: desired ${desiredOut}, escrow ${this.escrow[resourceOut]}, available ${availableOut}`,
            {tradeId: this.id, humanId: human.id});
        const amountIn = fulfilledOut * this.XinXout[side];

        if (this.escrow[resourceOut] > 0) {
            assert(amountIn <= human.supply[resourceIn],
                `human ${human.id} does not have enough supply to FULFILL trade: has ${human.supply[resourceIn]}, offered ${amountIn}`,
                {tradeId: this.id, humanId: human.id});

            human.supply[resourceIn] -= amountIn;
            human.supply[resourceOut] += fulfilledOut;
            human.volumeTradedFor[resourceOut] += fulfilledOut;

            const amountInOpposite = amountIn / this.XinYin[side];
            this.escrow[resourceOut] -= amountInOpposite;
            const partners = this.fulfillRequest(amountInOpposite, oppositeSide(side));
            for (const partner of partners) {
                const key = [human.id, partner.id].sort((a, b) => a - b).join('-');
                this.trade_partners.set(key, this.sim.tick);
            }

            const surplusIn = amountIn * this.surpluses[side];
            const surplusOut = amountInOpposite - fulfilledOut;

            this.labor -= amountIn * this.sim.params.laborPerResourceUnit;
            this.distributeSurplus(surplusIn, surplusOut, resourceIn, resourceOut);

            this.volumeMoved[side] += amountIn;
            this.volumeMoved[oppositeSide(side)] += amountInOpposite;

            this.sim.events.emit(EVENTS.TRADE_INVOKED, {
                trade: this, human, side, amountIn, amountOut: fulfilledOut, tick: this.sim.tick,
            });
        }

        if (amountIn < quantity) {
            this.addToEscrow(human, side, quantity - amountIn);
        }
        return fulfilledOut;
    }

    /**
     * Level-2+: the parent trade stands as counterparty on `parentSide`, paying out of its
     * accumulated supply. An agent that transacts here becomes a *manager* of the parent —
     * which extends the parent's visibility to everyone within the new manager's reach.
     * That reach extension is the functional payoff of hierarchy.
     */
    invokeHierarchical(human, side, quantity) {
        assert(side === this.agentSide(), 'Cannot invoke the parent-backed side of a hierarchical trade',
            {tradeId: this.id, side});

        this.invocations[side] += 1;
        this.invocations_since_last_checked[side] += 1;

        const resourceIn = this.resourcesIn[side];
        const resourceOut = this.resourceInOppositeSide(side);
        const desiredOut = quantity / this.XinXout[side];

        const amountInOpposite = desiredOut * this.YinXout[side];
        const parentAvailable = this.parentTrade.supply[resourceOut];
        const fulfilledRatio = Math.min(1, parentAvailable / amountInOpposite);
        const fulfilledOut = desiredOut * fulfilledRatio;
        const amountIn = fulfilledOut * this.XinXout[side];
        const fromParent = amountInOpposite * fulfilledRatio;

        if (fulfilledOut > Number.EPSILON && amountIn > Number.EPSILON) {
            assert(amountIn <= human.supply[resourceIn] + Number.EPSILON * 10,
                `human ${human.id} does not have enough supply for hierarchical trade: has ${human.supply[resourceIn]}, needed ${amountIn}`,
                {tradeId: this.id, humanId: human.id});

            human.supply[resourceIn] -= amountIn;
            human.supply[resourceOut] += fulfilledOut;
            human.volumeTradedFor[resourceOut] += fulfilledOut;

            this.parentTrade.supply[resourceOut] -= fromParent;
            const parentPayment = fromParent / this.XinXout[this.parentSide];
            this.parentTrade.supply[resourceIn] += parentPayment;

            const surplusIn = amountIn * this.surpluses[side];
            const surplusOut = fromParent - fulfilledOut;
            this.distributeSurplus(surplusIn, surplusOut, resourceIn, resourceOut);

            if (this.parentTrade.inventor && !this.parentTrade.inventor.removeFromWorld) {
                const key = [human.id, this.parentTrade.inventor.id].sort((a, b) => a - b).join('-');
                this.trade_partners.set(key, this.sim.tick);
            }
            this.invokers.set(human, this.sim.tick);

            if (!this.parentTrade.managers.has(human)) {
                this.parentTrade.managers.add(human);
                this.parentTrade.newManagers.push(human);
                this.sim.events.emit(EVENTS.MANAGER_ADDED, {
                    trade: this.parentTrade, viaTrade: this, human, tick: this.sim.tick,
                });
            }

            this.volumeMoved[side] += amountIn;
            this.volumeMoved[this.parentSide] += fromParent;

            this.sim.events.emit(EVENTS.TRADE_INVOKED, {
                trade: this, human, side, amountIn, amountOut: fulfilledOut, tick: this.sim.tick,
            });
        }
        return fulfilledOut;
    }

    /**
     * Route the spread.
     *
     * The inventor is the residual claimant until the trade acquires managers, at which
     * point the rent pools in `supply[]` and becomes the substrate the *next* level feeds
     * on. `surplusToTradeFraction` diverts a share into the pool even while the inventor
     * lives — at its default of 0, a trade can only accumulate after its founder dies,
     * which makes founder mortality the sole bootstrap into hierarchy (RESEARCH.md 1a/4b).
     */
    distributeSurplus(surplusIn, surplusOut, resourceIn, resourceOut) {
        const params = this.sim.params;
        const isManaged = this.managers.size > 0;
        const inventorDead = !this.inventor || this.inventor.removeFromWorld;

        let inventorShare;
        if (inventorDead) {
            inventorShare = 0;
        } else if (isManaged) {
            inventorShare = params.inventorPerpetualRoyalty;
        } else {
            inventorShare = 1 - params.surplusToTradeFraction;
        }

        if (inventorShare > 0) {
            this.inventor.supply[resourceIn] += surplusIn * inventorShare;
            this.inventor.supply[resourceOut] += surplusOut * inventorShare;
            this.inventor.totalRoyalties[resourceIn] += surplusIn * inventorShare;
            this.inventor.totalRoyalties[resourceOut] += surplusOut * inventorShare;
            this.sim.events.emit(EVENTS.SURPLUS_PAID, {
                trade: this, recipient: this.inventor, resourceIn, resourceOut,
                amountIn: surplusIn * inventorShare, amountOut: surplusOut * inventorShare,
                tick: this.sim.tick,
            });
        }
        const poolShare = 1 - inventorShare;
        if (poolShare > 0) {
            this.supply[resourceIn] += surplusIn * poolShare;
            this.supply[resourceOut] += surplusOut * poolShare;
        }
    }

    /**
     * Is this trade visible to `human`?
     *
     * Visibility is the union of the inventor's reach and every manager's reach, so each
     * manager acquired is a new broadcast node. `founderGhostReach` controls whether a dead
     * inventor keeps projecting: true (default) preserves historical behaviour, where a
     * region unlocked by a now-dead founder stays unlocked forever.
     */
    isWithinReach(human) {
        const inventorCounts = this.inventor &&
            (this.sim.params.founderGhostReach || !this.inventor.removeFromWorld);
        if (inventorCounts && distance(human, this.inventor) < this.inventor.socialReach) return true;
        for (const manager of this.managers) {
            if (distance(human, manager) < manager.socialReach) return true;
        }
        return false;
    }

    /**
     * Propagate visibility to everyone near a newly-acquired manager.
     *
     * Batched into the cleanup pass rather than run per invocation: this is a full scan of
     * the population, and running it inline made manager acquisition quadratic.
     */
    flushNewManagers(humans) {
        if (this.newManagers.length === 0) return;
        const rA = this.resourcesIn.A;
        const rB = this.resourcesIn.B;
        const newMgrs = this.newManagers;
        for (const human of humans) {
            if (human.removeFromWorld) continue;
            if (!newMgrs.some(m => distance(human, m) < m.socialReach)) continue;
            if (!human.my_trades[rA][rB].some(ti => ti.trade === this)) {
                human.my_trades[rA][rB].push({trade: this, side: 'A'});
                if (!this.isHierarchical) {
                    human.my_trades[rB][rA].push({trade: this, side: 'B'});
                }
            }
        }
        this.newManagers = [];
    }

    /**
     * Retire this trade and everything built on it.
     *
     * Deprecation cascades strictly downward, so losing a base-level market destroys the
     * whole tower above it. This is the systemic-fragility counterweight to hierarchy's
     * robustness against individual loss (RESEARCH.md 1c, 4e).
     */
    deprecate(cause = 'unspecified') {
        if (this.deprecated) return;
        this.deprecated = true;
        this.deathTick = this.sim.tick;
        this.deprecationCause = cause;
        this.sim.events.emit(EVENTS.TRADE_DEPRECATED, {trade: this, cause, tick: this.sim.tick});
        for (const child of this.childTrades) {
            child.deprecate('parent-deprecated');
        }
    }

    cleanDeadManagers() {
        for (const manager of this.managers) {
            if (manager.removeFromWorld) this.managers.delete(manager);
        }
    }

    /** Pay out queued counterparty requests on `side` against an incoming amount. */
    fulfillRequest(amountNeededTotal, side) {
        const partners = [];
        const resourceOut = this.resourcesIn[oppositeSide(side)];
        const requests = this.requests[side];
        let fulfilledTotal = 0;

        while (fulfilledTotal < amountNeededTotal - Number.EPSILON * 10) {
            // Escrow can drift fractionally above zero with no requests left to satisfy.
            if (requests.length === 0) break;
            const request = requests[0];
            const requester = request.human;
            partners.push(requester);
            const amount = Math.min(amountNeededTotal - fulfilledTotal, request.quantity);

            requester.supply[resourceOut] += amount / this.XinXout[side];
            requester.volumeTradedFor[resourceOut] += amount / this.XinXout[side];
            fulfilledTotal += amount;

            request.quantity -= amount;
            if (request.quantity === 0) requests.splice(0, 1);
        }
        return partners;
    }

    addToEscrow(human, side, quantity) {
        const resourceIn = this.resourcesIn[side];
        assert(quantity <= human.supply[resourceIn],
            `human ${human.id} does not have enough supply to ESCROW: has ${human.supply[resourceIn]}, offered ${quantity}`,
            {tradeId: this.id, humanId: human.id});
        this.escrow[resourceIn] += quantity;
        this.requests[side].push({human, side, quantity});
        human.supply[resourceIn] -= quantity;
    }

    /** Refund unmatched offers at end of tick. Safe for hierarchical trades, which never escrow. */
    clearEscrow(ledger) {
        for (const side of ['A', 'B']) {
            const resourceIn = this.resourcesIn[side];
            for (const request of this.requests[side]) {
                if (request.human.removeFromWorld) {
                    ledger.recordLost(resourceIn, request.quantity);
                } else {
                    request.human.supply[resourceIn] += request.quantity;
                }
            }
        }
        const totalResources = this.sim.params.numResources + this.sim.params.numAlternativeResources;
        this.escrow = Array(totalResources).fill(0);
        this.requests = {A: [], B: []};
    }

    resourceInOppositeSide(side) {
        if (side === 'A') return this.resourcesIn.B;
        if (side === 'B') return this.resourcesIn.A;
        throw new Error(`Side must be 'A' or 'B', got ${side}`);
    }

    /** Age in ticks, live or at death. */
    lifespan() {
        return (this.deathTick ?? this.sim.tick) - this.birthTick;
    }

    get totalVolume() {
        return this.volumeMoved.A + this.volumeMoved.B;
    }

    get totalInvocations() {
        return this.invocations.A + this.invocations.B;
    }
}

export function oppositeSide(side) {
    return side === 'A' ? 'B' : 'A';
}
