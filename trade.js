


class Trade {

    // NOTE: A and B are the two concrete sides of the trade, not specific resources. E.g. one agent gives Ain and gets Aout, or Bin and gets Bout.
    // X and Y are variables representing sides
    constructor(resourceA, resourceB, Ain, Aout, Bin, Bout) {
        assert(Ain >= Aout && Bin >= Bout, "Trade must have non-negative surplus");
        this.resourcesIn = {A: resourceA, B: resourceB};
        this.laborRequired = (Ain + Bin) * PARAMS.laborPerResourceUnit;

        this.XinXout = {A: Ain / Aout, B: Bin / Bout};
        this.YoutXin = {A: Bout / Ain, B: Aout / Bin};
        this.YinXout = {A: Bin / Aout, B: Ain / Bout}; 
        this.XinYin = {A: Ain / Bin, B: Bin / Ain};

        this.surpluses = {A: (Ain - Bout) / Ain, B: (Bin - Aout) / Bin};

        this.supply = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.labor = 0;

        this.escrow = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.requests = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill([]);
    }

    invoke(human, side, quantity) { // quantity to contribute to the trade, i.e. in terms of resource on 'side'
        const resourceOut = this.resourceInOppositeSide(side);
        
        if (this.escrow[resourceOut] > 0) {
            const resourceIn = this.resourcesIn[side];
            const desiredOut = quantity / this.XinXout[side];
            const availableOut = this.escrow[resourceOut] / this.YinXout[side];
            const amountFulfilled = Math.min(availableOut, desiredOut);
            assert(amountFulfilled >= 0, "this should be true if there is any resourceOut in escrow");
            const amountIn = amountFulfilled * this.XinXout[side];
            assert(amountIn <= human.supply[resourceIn], `human ${human.id} does not have enough supply to FULFILL trade!... has ${human.supply[resourceIn]}, offered ${amountIn}`);
            
            // side X
            human.supply[resourceIn] -= amountIn;
            human.supply[resourceOut] += amountFulfilled;
            
            
            
            // side Y
            const amountInOpposite = amountIn / this.XinYin[side]
            this.escrow[resourceOut] -= amountInOpposite;
            this.fulfillRequest(amountInOpposite, opposite_side(side));


            // surplus
            this.supply[resourceIn] += amountIn * this.surpluses[side];
            assert(amountInOpposite - amountFulfilled == amountInOpposite * this.surpluses[opposite_side(side)], "should be equal")
            // this.supply[resourceOut] += amountInOpposite * this.surpluses[opposite_side(side)];
            this.supply[resourceOut] += amountInOpposite - amountFulfilled; // surplus from the other side

            this.labor -= amountIn * PARAMS.laborPerResourceUnit;
        }

        if (amountFulfilled < desiredOut) {
            this.addToEscrow(human, side, quantity - amountIn);
        }
        
        // return amountFulfilled;
    }

    fulfillRequest(amountNeededTotal, side) {
        const resourceIn = this.resources[side];
        const resourceOut = this.resources[opposite_side(side)];
        const requests = this.requests[side];
        let amountFulfilledTotal = 0;

        let i = 0; 
        while (amountFulfilledTotal < amountNeededTotal) {
            // TODO: use more efficient queue data sructure for requests
            // TODO: use either a priority queue, or order based on size, or randomize, instead of merely FIFO 
            const request = requests[0];
            const requestingHuman = request.human;
            const amountFulfilled = Math.min(amountNeededTotal - amountFulfilledTotal, request.quantity)
            requestingHuman.supply[resourceIn] -= amountFulfilled;
            requestingHuman.supply[resourceOut] += amountFulfilled / this.XinXout[side];
            amountFulfilledTotal += amountFulfilled;

            request.quantity -= amountFulfilled;
            if (request.quantity == 0) {
                requests.splice(0, 1); // request is entirely fulfilled. 
            }
        }
    }

    addToEscrow(human, side, quantity) {
        const resourceIn = this.resources[side];
        const resourceOut = this.resourceInOppositeSide(side);
        

        assert(quantity <= human.supply[resourceIn], `human ${human.id} does not have enough supply to ESCROW for trade!... has ${human.supply[resourceIn]}, offered ${quantity}`);
        this.escrow[resourceIn] += quantity;
        this.requests[resourceIn].push({human: human, side: side, quantity: quantity});
    }


    clearEscrow() {

    }


    outResourceFromIn(resource) {
        if (resource === this.resources.A) return this.resources.B;
        if (resource === this.resources.B) return this.resources.A;
        throw "resource not part of trade";
    }

    
    resourceInOppositeSide(side) {
        if (side === 'A') return this.resources.B;
        if (side === 'B') return this.resources.A;
        throw "resource not part of trade";
    }



}

function opposite_side(side) {
    return side === 'A' ? 'B' : 'A';
}
