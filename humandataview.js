class HumanDataView {
    
    constructor(x, y) {
        this.x = x;          // top-left corner of the panel
        this.y = y;
        this.lineHeight = 20; // spacing between lines of text
        this.maxRows = 20;    // prevent overflow if there are too many humans
        
        this.panelWidth = PARAMS.leftpanelWidth;
        this.panelHeight = this.maxRows * this.lineHeight + 60; // + room for title
    }

    update() {
        // Nothing to compute here yet, but you could sort/filter if you want
    }


    
    draw(ctx) {
        ctx.save();

        // Outline panel
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.panelWidth, this.panelHeight);

        // Title
        ctx.fillStyle = "#000000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("Human Data View", this.x + 8, this.y + 8);

        // Column positions
        const colX = {
            id: this.x + 8,
            work: this.x + 30,
            supply: this.x + 60,
            metabolism: this.x + 200,
            energy: this.x + this.panelWidth - 110
        };

        const headerY = this.y + 28;

        // Column headers
        ctx.font = "12px monospace";
        ctx.fillText("ID", colX.id, headerY);
        ctx.fillText("Work", colX.work, headerY);
        ctx.fillText("Supply", colX.supply, headerY);
        ctx.fillText("Metabolism", colX.metabolism, headerY);
        ctx.fillText("Energy", colX.energy, headerY);

        // Separator line under headers
        ctx.beginPath();
        ctx.moveTo(this.x + 5, headerY + 15);
        ctx.lineTo(this.x + this.panelWidth - 5, headerY + 15);
        ctx.stroke();

        // Rows
        let row = 0;
        const startY = headerY + 25; // leave space under headers
        for (let human of gameEngine.automata.humans) {
            if (row >= this.maxRows) break;

            const rowY = startY + row * this.lineHeight;

            // ID
            ctx.fillStyle = "#000000";
            ctx.font = "12px monospace";
            ctx.fillText(`${human.id}`, colX.id, rowY);

            // work
            const work = human.is_laborer ? "L" : "P";
            ctx.fillText(`${work}`, colX.work+5, rowY);

            // Supplies
            const supplies = human.supply.map(v => v.toFixed(1)).join(", ");
            ctx.fillText(`[${supplies}]`, colX.supply, rowY);

            // Metabolism
            const metabolism = human.metabolism.map(v => v.toFixed(0)).join(", ");
            ctx.fillText(`[${metabolism}]`, colX.metabolism, rowY);

            // Energy stacked bar
            const barX = colX.energy;
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
            }

            ctx.strokeStyle = "#000000";
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            row++;
        }

        ctx.restore();
    }
}
