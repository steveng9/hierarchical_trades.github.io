class SelectionDataView {
    constructor(x, y, dataManager) {
        this.x = x;
        this.y = y;
        this.lineHeight = 18;
        this.rowHeight = this.lineHeight * 2; // two lines per human
        this.panelWidth = PARAMS.rightpanelwidth;
        this.maxRows = 30; // now means "max humans"
        this.dataManager = dataManager;

        // Column positions
        this.colX = {
            id: this.x + 8,
            work: this.x + 40,
            reach: this.x + 80,
            energy: this.x + 160,
            numTradesBuilt: this.x + 250,
            supply: this.x + 8,
            tradeVol: this.x + 220,
            royalties: this.x + 360,
            valuations: this.x + 480
        };
    }

    update() {}

    draw(ctx) {
        const humans = this.dataManager.humans_analyzed;
        ctx.save();

        // Panel background
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        const panelHeight = Math.min(this.maxRows, humans.length) * this.rowHeight + 100;
        ctx.strokeRect(this.x, this.y, this.panelWidth, panelHeight);

        // Title
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("Selection Data View", this.x + 8, this.y + 6);

        const headerY = this.y + 28;

        // Column headers (row 1 headers only)
        ctx.font = "12px monospace";
        ctx.fillText("ID", this.colX.id, headerY);
        ctx.fillText("Role", this.colX.work, headerY);
        ctx.fillText("Reach", this.colX.reach, headerY);
        ctx.fillText("Energy", this.colX.energy, headerY);
        ctx.fillText("Trades Built", this.colX.numTradesBuilt, headerY);
        ctx.fillText("Royalties", this.colX.royalties, headerY);

        // Row 2 headers
        ctx.fillText("Supply", this.colX.supply, headerY + this.lineHeight);
        ctx.fillText("Trade Vol.", this.colX.tradeVol, headerY + this.lineHeight);
        ctx.fillText("Value", this.colX.valuations, headerY + this.lineHeight);

        // Separator
        ctx.beginPath();
        ctx.moveTo(this.x + 5, headerY + this.lineHeight * 2 - 4);
        ctx.lineTo(this.x + this.panelWidth - 5, headerY + this.lineHeight * 2 - 4);
        ctx.stroke();

        // Data rows
        let row = 0;
        let totalEnergy = 0;
        let totalSupply = Array(PARAMS.numResources).fill(0);
        let totalMetabolism = Array(PARAMS.numResources).fill(0);
        let totalReach = 0;

        for (let human of humans) {
            if (row >= this.maxRows - 3) break;

            const baseY = headerY + (row + 1) * this.rowHeight;

            // --- First line ---
            ctx.fillStyle = "#000";
            ctx.fillText(`${human.id}`, this.colX.id, baseY);
            ctx.fillText(`${human.is_laborer ? "L" : "P"}`, this.colX.work, baseY);
            ctx.fillText(human.socialReach.toFixed(2), this.colX.reach, baseY);
            ctx.fillText(`${human.num_trades_built}`, this.colX.numTradesBuilt, baseY);
            ctx.fillText(`[${human.totalRoyalties.map(v => v.toFixed(0)).join(",")}]`, this.colX.royalties, baseY);


            // Energy stacked bar
            const barX = this.colX.energy;
            const barY = baseY - 2;
            const barWidth = 80;
            const barHeight = 10;
            const fractions = human.metabolism.map(v => v / PARAMS.maxHumanEnergy);
            const colors = ["red", "limegreen", "blue"];

            let offsetX = barX;
            for (let r = 0; r < PARAMS.numResources; r++) {
                const w = barWidth * fractions[r];
                ctx.fillStyle = colors[r];
                ctx.fillRect(offsetX, barY, w, barHeight);
                offsetX += w;
                totalMetabolism[r] += human.metabolism[r];
                totalSupply[r] += human.supply[r];
                totalEnergy += human.metabolism[r];
            }
            ctx.strokeStyle = "#000";

            ctx.strokeRect(barX, barY, barWidth, barHeight);
            // --- Second line ---
            const secondY = baseY + this.lineHeight;
            ctx.fillStyle = "#000";
            ctx.fillText(`[${human.supply.map(v => v.toFixed(1)).join(",")}]`, this.colX.supply, secondY);
            ctx.fillText(`[${human.volumeTradedFor.map(v => v.toFixed(1)).join(",")}]`, this.colX.tradeVol, secondY);

            const valuations = human.resource_valuations.map(v => v.toFixed(1)).join(", ");
            ctx.fillText(`[${valuations}]`, this.colX.valuations, secondY);

            totalReach += human.socialReach;
            row++;
        }

        // Aggregates
        if (humans.length > 0) {
            const aggY = headerY + (row + 1) * this.rowHeight + 20;
            ctx.font = "bold 12px monospace";
            ctx.fillText("Aggregate Stats:", this.x + 8, aggY);

            ctx.font = "12px monospace";
            ctx.fillText(`Avg Energy: ${(totalEnergy / humans.length).toFixed(1)}`, this.x + 8, aggY + this.lineHeight);
            ctx.fillText(`Total Supply: [${totalSupply.map(v => v.toFixed(1)).join(",")}]`, this.x + 220, aggY + this.lineHeight);
            ctx.fillText(`Avg Metabolism: [${totalMetabolism.map(v => (v / humans.length).toFixed(1)).join(",")}]`, this.x + 8, aggY + 2 * this.lineHeight);
            ctx.fillText(`Avg Reach: ${(totalReach / humans.length).toFixed(2)}`, this.x + 350, aggY + 2 * this.lineHeight);
        }

        ctx.restore();
    }
}
