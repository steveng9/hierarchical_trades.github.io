

class Trade {
    static lastTradeId = 0;

    // NOTE: A and B are the two concrete sides of the trade, not specific resources.
    // E.g. one agent gives Ain and gets Aout, or Bin and gets Bout.
    // X and Y are variables representing sides.
    // For hierarchical trades: parentSide is backed by parentTrade's supply, the other side is agent-facing.
    constructor(resourceA, resourceB, Ain, Aout, Bin, Bout, inventor, parentTrade = null, parentSide = null) {
        assert(Ain >= Bout && Bin >= Aout, `Trade must have non-negative surplus: Ain ${Ain.toFixed(2)}, Aout ${Aout.toFixed(2)}, Bin ${Bin.toFixed(2)}, Bout ${Bout.toFixed(2)}`);
        this.id = Trade.lastTradeId;
        Trade.lastTradeId += 1;

        this.inventor = inventor;
        this.resourcesIn = {A: resourceA, B: resourceB};
        this.laborRequired = (Ain + Bin) * PARAMS.laborPerResourceUnit;
        this.invocations = {A: 0, B: 0};
        this.invocations_since_last_checked = {A: 0, B: 0};
        this.volumeMoved = {A: 0, B: 0};

        this.XinXout = {A: Ain / Aout, B: Bin / Bout};
        this.YinXout = {A: Bin / Aout, B: Ain / Bout};
        this.XinYin = {A: Ain / Bin, B: Bin / Ain};

        this.surpluses = {A: (Ain - Bout) / Ain, B: (Bin - Aout) / Bin};

        this.supply = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.labor = 0;

        this.escrow = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.requests = {A: [], B: []};
        this.deprecated = false;

        this.trade_partners = new Map();

        // Hierarchy fields
        this.parentTrade = parentTrade;     // lower-level trade backing one side (null for level-1)
        this.parentSide = parentSide;       // which side of THIS trade is auto-supplied by parent ('A' or 'B', null for level-1)
        this.level = parentTrade ? parentTrade.level + 1 : 1;
        this.managers = new Set();          // humans who manage this trade (via higher-level trade invocations)
        this.invokers = new Map();          // human -> last-invoked tick (agent side only)
        this.newManagers = [];              // managers queued for batched spreadToReachOf
        this.childTrades = [];              // trades built on top of this one
    }

    get isHierarchical() {
        return this.parentTrade !== null;
    }

    agentSide() {
        if (!this.isHierarchical) return null;
        return opposite_side(this.parentSide);
    }

    invoke(human, side, quantity) {
        if (this.isHierarchical) {
            return this.invokeHierarchical(human, side, quantity);
        }
        return this.invokeLevel1(human, side, quantity);
    }

    // Level-1 trade invocation: both sides are agent-driven, uses escrow
    invokeLevel1(human, side, quantity) {
        this.invocations[side] += 1;
        this.invocations_since_last_checked[side] += 1;

        const resourceOut = this.resourceInOppositeSide(side);
        const resourceIn = this.resourcesIn[side];
        const desiredOut = quantity / this.XinXout[side];
        if (this.escrow[resourceOut] < 0) this.escrow[resourceOut] = 0; // clamp floating-point drift
        const availableOut = this.escrow[resourceOut] / this.YinXout[side];
        const fulfilledOut = Math.min(availableOut, desiredOut);
        assert(fulfilledOut >= 0, `fulfilledOut should be >= 0: desired: ${desiredOut}, escrow: ${this.escrow[resourceOut]}, available: ${availableOut}`);
        const amountIn = fulfilledOut * this.XinXout[side];

        if (this.escrow[resourceOut] > 0) {
            assert(amountIn <= human.supply[resourceIn], `human ${human.id} does not have enough supply to FULFILL trade: has ${human.supply[resourceIn]}, offered ${amountIn}`);

            // Agent side
            human.supply[resourceIn] -= amountIn;
            human.supply[resourceOut] += fulfilledOut;
            human.volumeTradedFor[resourceOut] += fulfilledOut;

            // Opposite side
            const amountInOpposite = amountIn / this.XinYin[side];
            this.escrow[resourceOut] -= amountInOpposite;
            const trade_partners = this.fulfillRequest(amountInOpposite, opposite_side(side));
            trade_partners.forEach(partner => {
                const key = [human.id, partner.id].sort((a, b) => a - b).join("-");
                this.trade_partners.set(key, gameEngine.automata.generation);
            });

            // Surplus
            const surplus_in = amountIn * this.surpluses[side];
            const surplus_out = amountInOpposite - fulfilledOut;

            this.labor -= amountIn * PARAMS.laborPerResourceUnit;

            this.distributeSurplus(surplus_in, surplus_out, resourceIn, resourceOut);

            this.volumeMoved[side] += amountIn;
            this.volumeMoved[opposite_side(side)] += amountInOpposite;
        }

        if (amountIn < quantity) {
            this.addToEscrow(human, side, quantity - amountIn);
        }

        return fulfilledOut;
    }

    // Hierarchical trade invocation: one side is backed by parentTrade's supply
    invokeHierarchical(human, side, quantity) {
        assert(side === this.agentSide(), `Cannot invoke parent-backed side of hierarchical trade`);

        this.invocations[side] += 1;
        this.invocations_since_last_checked[side] += 1;

        const resourceIn = this.resourcesIn[side];
        const resourceOut = this.resourceInOppositeSide(side);
        const desiredOut = quantity / this.XinXout[side];

        // Check parent trade's supply instead of escrow
        const parentResourceOut = resourceOut;
        const amountInOpposite = desiredOut * this.YinXout[side]; // how much parent needs to provide
        const parentAvailable = this.parentTrade.supply[parentResourceOut];
        const fulfilledRatio = Math.min(1, parentAvailable / amountInOpposite);
        const fulfilledOut = desiredOut * fulfilledRatio;
        const amountIn = fulfilledOut * this.XinXout[side];
        const actualAmountFromParent = amountInOpposite * fulfilledRatio;

        if (fulfilledOut > Number.EPSILON && amountIn > Number.EPSILON) {
            assert(amountIn <= human.supply[resourceIn] + Number.EPSILON * 10, `human ${human.id} does not have enough supply for hierarchical trade: has ${human.supply[resourceIn]}, needed ${amountIn}`);

            // Agent side: give resourceIn, get resourceOut
            human.supply[resourceIn] -= amountIn;
            human.supply[resourceOut] += fulfilledOut;
            human.volumeTradedFor[resourceOut] += fulfilledOut;

            // Parent side: parent gives resourceOut, receives resourceIn payment
            this.parentTrade.supply[parentResourceOut] -= actualAmountFromParent;

            // Parent receives payment (what opposite side would normally get as output)
            const parentPayment = actualAmountFromParent / this.XinXout[this.parentSide]; // Bout equivalent
            this.parentTrade.supply[resourceIn] += parentPayment;

            // Surplus
            const surplus_in = amountIn * this.surpluses[side];
            const surplus_out = actualAmountFromParent - fulfilledOut;

            this.distributeSurplus(surplus_in, surplus_out, resourceIn, resourceOut);

            // Track trade partners (human <-> parent trade's inventor, if alive)
            if (this.parentTrade.inventor && !this.parentTrade.inventor.removeFromWorld) {
                const key = [human.id, this.parentTrade.inventor.id].sort((a, b) => a - b).join("-");
                this.trade_partners.set(key, gameEngine.automata.generation);
            }

            this.invokers.set(human, gameEngine.automata.generation);

            // Agent becomes a manager of the parent trade, extending its reach (spread batched)
            if (!this.parentTrade.managers.has(human)) {
                this.parentTrade.managers.add(human);
                this.parentTrade.newManagers.push(human);
            }

            this.volumeMoved[side] += amountIn;
            this.volumeMoved[this.parentSide] += actualAmountFromParent;
        }

        return fulfilledOut;
    }

    // Distribute surplus based on management state
    distributeSurplus(surplus_in, surplus_out, resourceIn, resourceOut) {
        const isManaged = this.managers.size > 0;

        if (this.inventor?.removeFromWorld) {
            // Inventor dead — surplus stays in trade
            this.supply[resourceIn] += surplus_in;
            this.supply[resourceOut] += surplus_out;
        } else if (!isManaged) {
            // No managers yet — inventor gets surplus (incentive to invent)
            this.inventor.supply[resourceIn] += surplus_in;
            this.inventor.supply[resourceOut] += surplus_out;
            this.inventor.totalRoyalties[resourceIn] += surplus_in;
            this.inventor.totalRoyalties[resourceOut] += surplus_out;
        } else {
            // Trade IS managed — surplus goes to trade.supply[] for redistribution
            const perpetualRate = PARAMS.inventorPerpetualRoyalty;
            if (perpetualRate > 0) {
                this.inventor.supply[resourceIn] += surplus_in * perpetualRate;
                this.inventor.supply[resourceOut] += surplus_out * perpetualRate;
                this.inventor.totalRoyalties[resourceIn] += surplus_in * perpetualRate;
                this.inventor.totalRoyalties[resourceOut] += surplus_out * perpetualRate;
            }
            this.supply[resourceIn] += surplus_in * (1 - perpetualRate);
            this.supply[resourceOut] += surplus_out * (1 - perpetualRate);
        }
    }

    // Check if a human is within this trade's effective reach (inventor + managers)
    // Visibility is permanent: a region unlocked by a (now-dead) inventor or manager stays unlocked
    isWithinReach(human) {
        if (this.inventor && distance(human, this.inventor) < this.inventor.socialReach) return true;
        for (let manager of this.managers) {
            if (distance(human, manager) < manager.socialReach) return true;
        }
        return false;
    }

    // One pass through all humans checking all queued new managers at once.
    // Batched and called from cleanupTrades rather than on every invocation.
    flushNewManagers() {
        if (this.newManagers.length === 0) return;
        const rA = this.resourcesIn.A;
        const rB = this.resourcesIn.B;
        const newMgrs = this.newManagers;
        for (let human of gameEngine.automata.humans) {
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

    // Cascade deprecation downward to all child trades
    deprecate() {
        this.deprecated = true;
        for (let child of this.childTrades) {
            child.deprecate();
        }
    }

    // Remove dead humans from manager set
    cleanDeadManagers() {
        for (let manager of this.managers) {
            if (manager.removeFromWorld) {
                this.managers.delete(manager);
            }
        }
    }

    fulfillRequest(amountNeededTotal, side) {
        const trade_partners = [];
        const resourceOut = this.resourcesIn[opposite_side(side)];
        const requests = this.requests[side];
        let amountFulfilledTotal = 0;

        while (amountFulfilledTotal < amountNeededTotal - Number.EPSILON * 10) {
            if (requests.length === 0) break; // floating-point residual: escrow drifted above zero with no remaining requests
            const request = requests[0];
            const requestingHuman = request.human;
            trade_partners.push(requestingHuman);
            const amountFulfilled = Math.min(amountNeededTotal - amountFulfilledTotal, request.quantity);

            requestingHuman.supply[resourceOut] += amountFulfilled / this.XinXout[side];
            requestingHuman.volumeTradedFor[resourceOut] += amountFulfilled / this.XinXout[side];
            amountFulfilledTotal += amountFulfilled;

            request.quantity -= amountFulfilled;
            if (request.quantity == 0) {
                requests.splice(0, 1);
            }
        }
        return trade_partners;
    }

    addToEscrow(human, side, quantity) {
        const resourceIn = this.resourcesIn[side];
        assert(quantity <= human.supply[resourceIn], `human ${human.id} does not have enough supply to ESCROW: has ${human.supply[resourceIn]}, offered ${quantity}`);
        this.escrow[resourceIn] += quantity;
        this.requests[side].push({human: human, side: side, quantity: quantity});
        human.supply[resourceIn] -= quantity;
    }

    clearEscrow() {
        for (let side of ['A', 'B']) {
            const resourceIn = this.resourcesIn[side];
            for (let request of this.requests[side]) {
                if (request.human.removeFromWorld) {
                    // Human died after escrowing — log the stranded quantity as lost
                    gameEngine.total_lost[resourceIn] += request.quantity;
                } else {
                    request.human.supply[resourceIn] += request.quantity;
                }
            }
        }
        this.escrow = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.requests = {A: [], B: []};
    }

    resourceInOppositeSide(side) {
        if (side === 'A') return this.resourcesIn.B;
        if (side === 'B') return this.resourcesIn.A;
        throw "resource not part of trade";
    }
}

function opposite_side(side) {
    return side === 'A' ? 'B' : 'A';
}
