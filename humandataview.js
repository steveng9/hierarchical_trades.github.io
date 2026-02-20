class HumanDataView {

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.lineHeight = 18;
        this.maxRows = 20;
        this.panelWidth = PARAMS.leftpanelWidth;
        this.panelHeight = this.maxRows * this.lineHeight + 55;

        this.selectedHumans = new Set(); // human IDs selected via click
    }

    handleClick(mouseX, mouseY) {
        if (mouseX < this.x || mouseX > this.x + this.panelWidth ||
            mouseY < this.y || mouseY > this.y + this.panelHeight) return;

        const dataStartY = this.y + 48;
        const row = Math.floor((mouseY - dataStartY) / this.lineHeight);

        if (row >= 0 && row < this.maxRows && row < gameEngine.automata.humans.length) {
            const human = gameEngine.automata.humans[row];
            if (this.selectedHumans.has(human.id)) {
                this.selectedHumans.delete(human.id);
            } else {
                this.selectedHumans.add(human.id);
            }
            this.syncSelection();
        }
    }

    clearSelection() {
        this.selectedHumans.clear();
        this.syncSelection();
    }

    // Sync our selection to the datamanager's humans_analyzed list (used by SelectionManager to draw)
    syncSelection() {
        const dm = gameEngine.automata.datamanager;
        dm.humans_analyzed = [];
        for (let human of gameEngine.automata.humans) {
            if (this.selectedHumans.has(human.id)) {
                dm.humans_analyzed.push(human);
            }
        }
    }

    update() {}

    draw(ctx) {
        // Clean dead humans from selection
        for (let id of this.selectedHumans) {
            if (!gameEngine.automata.humanById.has(id)) {
                this.selectedHumans.delete(id);
            }
        }

        ctx.save();

        // Panel outline
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.panelWidth, this.panelHeight);

        // Title
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        const selCount = this.selectedHumans.size;
        const title = selCount > 0 ? `Human Data View (${selCount} selected)` : "Human Data View";
        ctx.fillText(title, this.x + 8, this.y + 6);

        // Column layout
        const cols = {
            id:         this.x + 8,
            work:       this.x + 38,
            supply:     this.x + 60,
            metabolism: this.x + 195,
            energy:     this.x + this.panelWidth - 110,
        };

        // Column headers
        const headerY = this.y + 28;
        ctx.font = "11px monospace";
        ctx.fillStyle = "#555";
        ctx.fillText("ID", cols.id, headerY);
        ctx.fillText("W", cols.work, headerY);
        ctx.fillText("Supply", cols.supply, headerY);
        ctx.fillText("Metabolism", cols.metabolism, headerY);
        ctx.fillText("Energy", cols.energy, headerY);

        // Separator
        const sepY = headerY + 14;
        ctx.beginPath();
        ctx.moveTo(this.x + 5, sepY);
        ctx.lineTo(this.x + this.panelWidth - 5, sepY);
        ctx.strokeStyle = "#999";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Data rows
        const dataStartY = sepY + 6;
        let row = 0;
        const barWidth = 100;
        const barHeight = 10;
        const resourceColors = ["#DD3333", "#33BB33", "#3366DD"];

        for (let human of gameEngine.automata.humans) {
            if (row >= this.maxRows) break;
            const rowY = dataStartY + row * this.lineHeight;

            // Highlight selected rows
            if (this.selectedHumans.has(human.id)) {
                ctx.fillStyle = "rgba(0, 200, 255, 0.15)";
                ctx.fillRect(this.x + 3, rowY - 2, this.panelWidth - 6, this.lineHeight);
            }

            ctx.fillStyle = "#000";
            ctx.font = "11px monospace";

            // ID
            ctx.fillText(`H${human.id}`, cols.id, rowY);

            // Work type
            ctx.fillText(human.is_laborer ? "L" : "P", cols.work, rowY);

            // Supply
            const supplies = human.supply.map(v => v.toFixed(1)).join(", ");
            ctx.fillText(`[${supplies}]`, cols.supply, rowY);

            // Metabolism
            const metabolism = human.metabolism.map(v => v.toFixed(0)).join(", ");
            ctx.fillText(`[${metabolism}]`, cols.metabolism, rowY);

            // Energy stacked bar
            const barX = cols.energy;
            const barY = rowY + 2;
            const fractions = human.metabolism.map(v => v / PARAMS.maxHumanEnergy);
            let offsetX = barX;

            for (let r = 0; r < PARAMS.numResources; r++) {
                const w = barWidth * fractions[r];
                ctx.fillStyle = resourceColors[r];
                ctx.fillRect(offsetX, barY, w, barHeight);
                offsetX += w;
            }

            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            row++;
        }

        ctx.restore();
    }
}
