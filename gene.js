class RealGene {
    constructor({
        geneValue = generateNormalSample(.5,PARAMS.initialVariation),
        minValue = 0,
        maxValue = 1,
        clipValue = true,
        name = "",
        mutationLevel = PARAMS.mutationRange,
    }) {
        this.value = geneValue;
        this.minValue = minValue;
        this.maxValue = maxValue;
        this.clipValue = clipValue;
        this.name = name;
        this.mutationLevel = mutationLevel;
        this.clip();
    }

    mutate() {
        // this.value += Math.random() * range - range / 2;
        // this.value *= (1 + generateNormalSample(0, this.mutationLevel));
        this.value += generateNormalSample(0, this.mutationLevel);
        this.clip();
    }

    clip() {
        if (this.clipValue) {
            this.value = Math.min(this.value, this.maxValue);
            this.value = Math.max(this.value, this.minValue);
        }
    }

    copy() {
        return new RealGene({
            geneValue: this.value,
            minValue: this.minValue,
            maxValue: this.maxValue,
            clipValue: this.clipValue,
            name: this.name,
            mutationLevel: this.mutationLevel,
        });
    }
};



class HumanGeneSet {
    constructor({parentGeneSet = null, allStateSizes = [], numActions = []}) {
        if (parentGeneSet) {
            this.initialQValues = parentGeneSet.initialQValues.map(gene => gene.copy());
            this.initialQValues.forEach(qVal => { qVal.mutate(); });
            this.initialEpsilon = parentGeneSet.initialEpsilon.copy();
            this.initialEpsilon.mutate();
            this.sexDriveGene = parentGeneSet.sexDriveGene.copy();
            this.sexDriveGene.mutate();
        } else {
            // this.initialQValues = Array(numQGenes).fill(new RealGene({ geneValue: 0, clipValue: false }));
            this.initialQValues = this.initAllQValueGenes(allStateSizes, numActions);
            this.initialEpsilon = new RealGene({});
            this.sexDriveGene = new RealGene({});
        }
    }

    initAllQValueGenes(allStateSizes, numActions) {
        const states = [];
        function backtrack(index, current) {
            if (index === allStateSizes.length) {
                states.push(current.join(""));
                return;
            }

            for (let i = 0; i < allStateSizes[index]; i++) {
                current.push(String(i));
                backtrack(index + 1, current);
                current.pop();
            }
        }
        backtrack(0, []);

        let genes = [];
        states.forEach(state => {
            for (let j = 0; j < numActions; j++) {
                genes.push(new RealGene({
                    geneValue: 0,
                    clipValue: false,
                    name: stateActionPair(state, j),
                    mutationLevel: PARAMS.qGeneMutationStd
                }));
            }
        });
        return genes;
    }
}