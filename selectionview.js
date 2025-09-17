

class SelectionDataView {
    constructor(x, y, dataManager) {
        this.x = x;
        this.y = y;
        this.lineHeight = 18;
        this.panelWidth = PARAMS.rightpanelwidth;
        this.maxRows = 30;
        this.dataManager = dataManager;

        // Column positions
        this.colX = {
            id: this.x + 8,
            work: this.x + 40,
            reach: this.x + 60,
            supply: this.x + 110,
            energy: this.x + 220,
            tradeVol: this.x + 340,
            royalties: this.x + 430,
            valuations: this.x + 500
        };
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
        const panelHeight = Math.min(this.maxRows, humans.length + 4) * this.lineHeight + 80;
        ctx.strokeRect(this.x, this.y, this.panelWidth, panelHeight);

        // Title
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("Selection Data View", this.x + 8, this.y + 6);

        const headerY = this.y + 28;

        // Column headers
        ctx.font = "12px monospace";
        ctx.fillText("ID", this.colX.id, headerY);
        // ctx.fillText("Work", this.colX.work, headerY);
        ctx.fillText("Reach", this.colX.reach, headerY);
        ctx.fillText("Supply", this.colX.supply, headerY);
        ctx.fillText("Energy", this.colX.energy, headerY);
        ctx.fillText("Trade Vol.", this.colX.tradeVol, headerY);
        ctx.fillText("Roy.", this.colX.royalties, headerY);
        ctx.fillText("Value", this.colX.valuations, headerY);

        // Separator
        ctx.beginPath();
        ctx.moveTo(this.x + 5, headerY + this.lineHeight - 4);
        ctx.lineTo(this.x + this.panelWidth - 5, headerY + this.lineHeight - 4);
        ctx.stroke();

        // Individual human rows
        let row = 0;
        let totalEnergy = 0;
        let totalSupply = Array(PARAMS.numResources).fill(0);
        let totalMetabolism = Array(PARAMS.numResources).fill(0);
        let totalReach = 0;

        for (let human of humans) {
            if (row >= this.maxRows - 3) break; // leave space for aggregates

            const rowY = headerY + (row + 1) * this.lineHeight;

            ctx.fillStyle = "#000";
            ctx.fillText(`${human.id}`, this.colX.id, rowY);
            ctx.fillText(`${human.is_laborer ? "L" : "P"}`, this.colX.work, rowY);
            ctx.fillText(human.socialReach.toFixed(2), this.colX.reach, rowY);
            ctx.fillText(`[${human.supply.map(v => v.toFixed(1)).join(",")}]`, this.colX.supply, rowY);
            ctx.fillText(`[${human.volumeTradedFor.map(v => v.toFixed(1)).join(",")}]`, this.colX.tradeVol, rowY);
            ctx.fillText(`[${human.totalRoyalties.map(v => v.toFixed(0)).join(",")}]`, this.colX.royalties, rowY);

            // Energy stacked bar
            const barX = this.colX.energy;
            const barY = rowY + 2;
            const barWidth = 100;
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

            // Resource valuations
            const valuations = human.resource_valuations.map(v => v.toFixed(1)).join(", ");
            ctx.fillStyle = "#000";
            ctx.fillText(`[${valuations}]`, this.colX.valuations, rowY);

            totalReach += human.socialReach;

            row++;
        }

        // Aggregates
        if (humans.length > 0) {
            const aggY = headerY + (row + 2) * this.lineHeight;
            ctx.font = "bold 12px monospace";
            ctx.fillText("Aggregate Stats:", this.x + 8, aggY);

            ctx.font = "12px monospace";
            ctx.fillText(`Avg Energy: ${(totalEnergy / humans.length).toFixed(1)}`, this.x + 8, aggY + this.lineHeight);
            ctx.fillText(`Total Supply: [${totalSupply.map(v => v.toFixed(1)).join(",")}]`, this.x + 200, aggY + this.lineHeight);
            ctx.fillText(`Avg Metabolism: [${totalMetabolism.map(v => (v / humans.length).toFixed(1)).join(",")}]`, this.x + 8, aggY + 2*this.lineHeight);
            ctx.fillText(`Avg Reach: ${(totalReach / humans.length).toFixed(2)}`, this.x + 350, aggY + 2*this.lineHeight);
        }

        ctx.restore();
    }
}
