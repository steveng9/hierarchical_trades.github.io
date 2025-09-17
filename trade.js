


class Trade {

    // NOTE: A and B are the two concrete sides of the trade, not specific resources. E.g. one agent gives Ain and gets Aout, or Bin and gets Bout.
    // X and Y are variables representing sides
    constructor(resourceA, resourceB, Ain, Aout, Bin, Bout, inventor) {
        assert(Ain >= Bout && Bin >= Aout, `Trade must have non-negative surplus: Ain ${Ain.toFixed(2)}, Aout ${Aout.toFixed(2)}, Bin ${Bin.toFixed(2)}, Bout ${Bout.toFixed(2)}`);
        this.inventor = inventor;
        this.resourcesIn = {A: resourceA, B: resourceB};
        this.laborRequired = (Ain + Bin) * PARAMS.laborPerResourceUnit;
        this.invocations = {A: 0, B: 0};
        this.invocations_since_last_checked = {A: 0, B: 0}; 
        this.volumeMoved = {A: 0, B: 0};

        this.XinXout = {A: Ain / Aout, B: Bin / Bout};
        this.YoutXin = {A: Bout / Ain, B: Aout / Bin};
        this.YinXout = {A: Bin / Aout, B: Ain / Bout}; 
        this.XinYin = {A: Ain / Bin, B: Bin / Ain};

        this.surpluses = {A: (Ain - Bout) / Ain, B: (Bin - Aout) / Bin};

        this.supply = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.labor = 0;

        this.escrow = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.requests = {A: [], B: []};
        this.deprecated = false;

        this.trade_partners = new Map();
    }

    invoke(human, side, quantity) { // quantity to contribute to the trade, i.e. in terms of resource on 'side'
        this.invocations[side] += 1;
        this.invocations_since_last_checked[side] += 1;

        const resourceOut = this.resourceInOppositeSide(side);
        
        const resourceIn = this.resourcesIn[side];
        const desiredOut = quantity / this.XinXout[side];
        const availableOut = this.escrow[resourceOut] / this.YinXout[side];
        const amountFulfilled = Math.min(availableOut, desiredOut);
        assert(amountFulfilled >= 0 - Number.EPSILON*10, `this should be true if there is any resourceOut in escrow: desired: ${desiredOut}, escrow: ${this.escrow[resourceOut]}, available: ${availableOut}`);
        const amountIn = amountFulfilled * this.XinXout[side];
        if (this.escrow[resourceOut] > 0) {
            assert(amountIn <= human.supply[resourceIn], `human ${human.id} does not have enough supply to FULFILL trade!... has ${human.supply[resourceIn]}, offered ${amountIn}`);
            
            // side X
            human.supply[resourceIn] -= amountIn;
            human.supply[resourceOut] += amountFulfilled;
            human.volumeTradedFor[resourceOut] += amountFulfilled;
            
            
            
            // side Y
            const amountInOpposite = amountIn / this.XinYin[side];
            this.escrow[resourceOut] -= amountInOpposite;
            const trade_partners = this.fulfillRequest(amountInOpposite, opposite_side(side));
            trade_partners.forEach(partner => {
                const key = `${human.id}-${partner.id}`;
                this.trade_partners.set(key, (this.trade_partners.get(key) || 0) + 1);
            });

            // surplus
            const surplus_in = amountIn * this.surpluses[side];
            const tolerance = Number.EPSILON*20;
            assert(Math.abs((amountInOpposite - amountFulfilled) - (amountInOpposite * this.surpluses[opposite_side(side)])) < tolerance, `should be equal: ${amountInOpposite - amountFulfilled}, ${amountInOpposite * this.surpluses[opposite_side(side)]}`)
            // this.supply[resourceOut] += amountInOpposite * this.surpluses[opposite_side(side)];
            const surplus_out = amountInOpposite - amountFulfilled; // surplus from the other side
            
            this.labor -= amountIn * PARAMS.laborPerResourceUnit;
            
            // inventor
            if (this.inventor?.removeFromWorld) {
                this.supply[resourceIn] += surplus_in;
                this.supply[resourceOut] += surplus_out;
            } else {
                this.supply[resourceIn] += surplus_in * (1 - PARAMS.royalty);
                this.supply[resourceOut] += surplus_out * (1 - PARAMS.royalty);
                this.inventor.supply[resourceIn] += surplus_in * PARAMS.royalty; 
                this.inventor.supply[resourceOut] += surplus_out * PARAMS.royalty;
                this.inventor.totalRoyalties[resourceIn] += surplus_in * PARAMS.royalty; 
                this.inventor.totalRoyalties[resourceOut] += surplus_out * PARAMS.royalty; 
            }

            this.volumeMoved[side] += amountIn;
            this.volumeMoved[opposite_side(side)] += amountInOpposite;
        }

        if (amountIn < quantity) {
            this.addToEscrow(human, side, quantity - amountIn);
        }
        
        return amountFulfilled;
    }

    fulfillRequest(amountNeededTotal, side) {
        const trade_partners = [];
        const resourceIn = this.resourcesIn[side];
        const resourceOut = this.resourcesIn[opposite_side(side)];
        const requests = this.requests[side];
        let amountFulfilledTotal = 0;

        while (amountFulfilledTotal < amountNeededTotal - Number.EPSILON*10) {
            // TODO: use more efficient queue data sructure for requests
            // TODO: use either a priority queue, or order based on size, or randomize, instead of merely FIFO 
            const request = requests[0];
            const requestingHuman = request.human;
            trade_partners.push(requestingHuman);
            const amountFulfilled = Math.min(amountNeededTotal - amountFulfilledTotal, request.quantity);

            // this step already taken care of in 'addToEscrow'
            // assert(requestingHuman.supply[resourceIn] >= amountFulfilled, `requester ${requestingHuman.id} over-requested ${request.quantity}, only can fulfill ${requestingHuman.supply[resourceIn]}`);
            // requestingHuman.supply[resourceIn] -= amountFulfilled;

            requestingHuman.supply[resourceOut] += amountFulfilled / this.XinXout[side];
            requestingHuman.volumeTradedFor[resourceOut] += amountFulfilled / this.XinXout[side];
            amountFulfilledTotal += amountFulfilled;

            request.quantity -= amountFulfilled;
            if (request.quantity == 0) {
                requests.splice(0, 1); // request is entirely fulfilled. 
            }
        }
        return trade_partners;
    }

    addToEscrow(human, side, quantity) {
        const resourceIn = this.resourcesIn[side];
        
        assert(quantity <= human.supply[resourceIn], `human ${human.id} does not have enough supply to ESCROW for trade!... has ${human.supply[resourceIn]}, offered ${quantity}`);
        this.escrow[resourceIn] += quantity;
        this.requests[side].push({human: human, side: side, quantity: quantity});
        human.supply[resourceIn] -= quantity; // temporarily hold supply so it isn't promised elsewhere.
    }


    clearEscrow() {
        for (let side of ['A', 'B']) {
            for (let request of this.requests[side]) {
                request.human.supply[this.resourcesIn[side]] += request.quantity;
            }
        }
        this.escrow = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.requests = {A: [], B: []};

        
    }


    outResourceFromIn(resource) {
        if (resource === this.resources.A) return this.resources.B;
        if (resource === this.resources.B) return this.resources.A;
        throw "resource not part of trade";
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
