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

    get currentPanelHeight() {
        return Math.min(this.maxRows, this.dataManager.humans_analyzed.length) * this.rowHeight + 100;
    }

    update() {}

    draw(ctx) {
        const humans = this.dataManager.humans_analyzed;
        ctx.save();
        ctx.textAlign = "left";
        ctx.textBaseline = "top";

        // Panel background (clears previous frame)
        const panelHeight = Math.min(this.maxRows, humans.length) * this.rowHeight + 100;
        ctx.fillStyle = "#fff";
        ctx.fillRect(this.x, this.y, this.panelWidth, panelHeight);

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.panelWidth, panelHeight);

        // Title
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("Selection Data View", this.x + 8, this.y + 6);

        const headerY = this.y + 28;

        // Column headers (row 1 headers only)
        ctx.font = "11px monospace";
        ctx.fillStyle = "#555";
        ctx.fillText("ID", this.colX.id, headerY);
        ctx.fillText("Role", this.colX.work, headerY);
        ctx.fillText("Reach", this.colX.reach, headerY);
        ctx.fillText("Energy", this.colX.energy, headerY);
        ctx.fillText("Trades Built", this.colX.numTradesBuilt, headerY);
        ctx.fillText("Royalties", this.colX.royalties, headerY);

        // Row 2 headers
        ctx.fillText("Supply", this.colX.supply, headerY + this.lineHeight);
        ctx.fillText("Trd/Prd per resource", this.colX.tradeVol, headerY + this.lineHeight);
        ctx.fillText("Value", this.colX.valuations, headerY + this.lineHeight);

        // Separator
        ctx.beginPath();
        ctx.moveTo(this.x + 5, headerY + this.lineHeight * 2 - 4);
        ctx.lineTo(this.x + this.panelWidth - 5, headerY + this.lineHeight * 2 - 4);
        ctx.strokeStyle = "#999";
        ctx.lineWidth = 1;
        ctx.stroke();

        const resColors    = ["#DD3333", "#33BB33", "#3366DD", "#CC9922", "#993399"];
        const resNames     = ["R", "G", "B", "Y", "P"];
        const barW = 40, barH = 7;

        // Data rows
        let row = 0;
        let totalEnergy = 0;
        let totalSupply = Array(PARAMS.numResources).fill(0);
        let totalMetabolism = Array(PARAMS.numResources).fill(0);
        let totalReach = 0;
        let totalTradeInv = Array(PARAMS.numResources).fill(0);
        let totalProdTicks = Array(PARAMS.numResources).fill(0);

        for (let human of humans) {
            if (row >= this.maxRows - 3) break;

            const baseY = headerY + (row + 1) * this.rowHeight;

            // --- First line ---
            ctx.fillStyle = "#000";
            ctx.font = "11px monospace";
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
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            // --- Second line ---
            const secondY = baseY + this.lineHeight;
            ctx.fillStyle = "#000";
            ctx.font = "11px monospace";
            const supplyStr = human.supply
                .slice(0, PARAMS.numResources)
                .map((v, i) => `${["R","G","B"][i] ?? i}:${v.toFixed(1)}`)
                .filter(s => !s.endsWith(":0.0"))
                .join(" ") || "--";
            ctx.fillText(supplyStr, this.colX.supply, secondY);

            // Trade-vs-produce mini bars — one per resource
            for (let r = 0; r < PARAMS.numResources; r++) {
                const bx = this.colX.tradeVol + r * 70;
                const by = secondY + 2;
                const trd = human.tradeInvocations[r] || 0;
                const prd = human.productionTicks[r]  || 0;
                const total = trd + prd;
                totalTradeInv[r]  += trd;
                totalProdTicks[r] += prd;

                // Resource letter label
                ctx.fillStyle = resColors[r];
                ctx.fillText(resNames[r] ?? r, bx, secondY);

                // Bar background (empty)
                ctx.fillStyle = "#eee";
                ctx.fillRect(bx + 9, by, barW, barH);

                if (total > 0) {
                    const tradeFrac = trd / total;
                    // Trade portion — lighter (globalAlpha trick)
                    ctx.globalAlpha = 0.45;
                    ctx.fillStyle = resColors[r];
                    ctx.fillRect(bx + 9, by, tradeFrac * barW, barH);
                    ctx.globalAlpha = 1;
                    // Produce portion — full color
                    ctx.fillStyle = resColors[r];
                    ctx.fillRect(bx + 9 + tradeFrac * barW, by, (1 - tradeFrac) * barW, barH);
                }
                ctx.strokeStyle = "#999";
                ctx.lineWidth = 0.5;
                ctx.strokeRect(bx + 9, by, barW, barH);
            }

            const valuations = human.resource_valuations.map(v => v.toFixed(1)).join(", ");
            ctx.fillText(`[${valuations}]`, this.colX.valuations, secondY);

            totalReach += human.socialReach;
            row++;
        }

        // Aggregates
        if (humans.length > 0) {
            const aggY = headerY + (row + 1) * this.rowHeight + 20;
            ctx.fillStyle = "#000";
            ctx.font = "bold 11px monospace";
            ctx.fillText("Aggregate Stats:", this.x + 8, aggY);

            ctx.font = "11px monospace";
            ctx.fillText(`Avg Energy: ${(totalEnergy / humans.length).toFixed(1)}`, this.x + 8, aggY + this.lineHeight);
            const supplyAggStr = totalSupply.slice(0, PARAMS.numResources).map((v, i) => `${["R","G","B"][i] ?? i}:${v.toFixed(1)}`).join(" ");
            ctx.fillText(`Total Supply: ${supplyAggStr}`, this.x + 220, aggY + this.lineHeight);
            const metabAggStr = totalMetabolism.slice(0, PARAMS.numResources).map((v, i) => `${["R","G","B"][i] ?? i}:${(v / humans.length).toFixed(1)}`).join(" ");
            ctx.fillText(`Avg Metabolism: ${metabAggStr}`, this.x + 8, aggY + 2 * this.lineHeight);
            ctx.fillText(`Avg Reach: ${(totalReach / humans.length).toFixed(2)}`, this.x + 350, aggY + 2 * this.lineHeight);

            // Avg trade % per resource
            const trdPctStr = totalTradeInv.slice(0, PARAMS.numResources).map((t, r) => {
                const total = t + totalProdTicks[r];
                const pct = total > 0 ? Math.round(t / total * 100) : 0;
                return `${resNames[r] ?? r}:${pct}%T`;
            }).join("  ");
            ctx.fillText(`Avg Trd%: ${trdPctStr}`, this.x + 8, aggY + 3 * this.lineHeight);
        }

        ctx.restore();
    }
}
