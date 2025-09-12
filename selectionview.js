class SelectionDataView {
    constructor(x, y, dataManager) {
        this.x = x;
        this.y = y;
        this.lineHeight = 18;
        this.panelWidth = 500;
        this.maxRows = 12;
        this.dataManager = dataManager;
    }

    update() {
        // Could add sorting/filtering later if needed
    }

    draw(ctx) {
        const humans = this.dataManager.humans_analyzed;
        ctx.save();

        // Panel background
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        const panelHeight = Math.min(this.maxRows, humans.length + 4) * this.lineHeight + 50;
        ctx.strokeRect(this.x, this.y, this.panelWidth, panelHeight);

        // Title
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("Selection Data View", this.x + 8, this.y + 6);

        const startY = this.y + 28;

        // Column headers
        ctx.font = "12px monospace";
        ctx.fillText("ID", this.x + 8, startY);
        ctx.fillText("Energy", this.x + 60, startY);
        ctx.fillText("Supply", this.x + 140, startY);
        ctx.fillText("Metabolism", this.x + 260, startY);
        ctx.fillText("SocReach", this.x + 400, startY);

        ctx.beginPath();
        ctx.moveTo(this.x + 5, startY + this.lineHeight - 4);
        ctx.lineTo(this.x + this.panelWidth - 5, startY + this.lineHeight - 4);
        ctx.stroke();

        // Individual human rows
        let row = 0;
        let totalEnergy = 0;
        let totalSupply = Array(PARAMS.numResources).fill(0);
        let totalMetabolism = Array(PARAMS.numResources).fill(0);
        let totalReach = 0;

        for (let human of humans) {
            if (row >= this.maxRows - 3) break; // leave space for aggregates

            const rowY = startY + (row + 1) * this.lineHeight;

            ctx.fillText(`H${human.id}`, this.x + 8, rowY);
            // ctx.fillText(human.energy.toFixed(1), this.x + 60, rowY);
            ctx.fillText(`[${human.supply.map(v => v.toFixed(1)).join(",")}]`, this.x + 140, rowY);
            ctx.fillText(`[${human.metabolism.map(v => v.toFixed(0)).join(",")}]`, this.x + 260, rowY);
            ctx.fillText(human.socialReach.toFixed(2), this.x + 400, rowY);

            for (let r = 0; r < PARAMS.numResources; r++) {
                totalSupply[r] += human.supply[r];
                totalMetabolism[r] += human.metabolism[r];
                totalEnergy += human.metabolism[r];
            }
            totalReach += human.socialReach;

            row++;
        }

        // Aggregates
        if (humans.length > 0) {
            const aggY = startY + (row + 2) * this.lineHeight;
            ctx.font = "bold 12px monospace";
            ctx.fillText("Aggregate Stats:", this.x + 8, aggY);

            ctx.font = "12px monospace";
            ctx.fillText(`Avg Energy: ${(totalEnergy / humans.length).toFixed(1)}`, this.x + 8, aggY + this.lineHeight);
            ctx.fillText(`Total Supply: [${totalSupply.map(v => v.toFixed(1)).join(",")}]`, this.x + 180, aggY + this.lineHeight);
            ctx.fillText(`Avg Metabolism: [${totalMetabolism.map(v => (v / humans.length).toFixed(1)).join(",")}]`, this.x + 8, aggY + 2*this.lineHeight);
            ctx.fillText(`Avg Reach: ${(totalReach / humans.length).toFixed(2)}`, this.x + 350, aggY + 2*this.lineHeight);
        }

        ctx.restore();
    }
}
