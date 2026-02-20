class SelectionManager {
    constructor() {
        this.start = null;
        this.end = null;
        this.isSpawning = false;
        this.isSelecting = false;
        this.tempHuman = null;
        this.forest = gameEngine.automata.forest;
    }

    beginSelection(x, y) {
        if (x > PARAMS.margin && x < PARAMS.margin + PARAMS.forestwidth &&
            y > PARAMS.margin && y < PARAMS.margin + PARAMS.forestheight) {
            this.isSelecting = true;
            this.start = {x, y};
            this.end = {x, y};
        }
    }

    beginSpawn(x, y) {
        if (x > PARAMS.margin && x < PARAMS.margin + PARAMS.forestwidth &&
            y > PARAMS.margin && y < PARAMS.margin + PARAMS.forestheight) {
            this.start = {x, y};
            this.end = {x, y};
            this.isSpawning = true;
            this.isSelecting = false;
            this.tempHuman = new Human({x: x - this.forest.x, y: y - this.forest.y, reach: 0, isSpawning: true});
            gameEngine.automata.add_human(this.tempHuman);
        }
    }

    updateSelection(x, y) {
        if (!this.isSelecting) return;
        this.end = {x, y};
    }

    updateSpawn(x, y) {
        if (!this.isSpawning || !this.tempHuman) return;
        this.end = {x, y};
        const dx = this.end.x - this.start.x;
        const dy = this.end.y - this.start.y;
        this.tempHuman.socialReach = Math.sqrt(dx * dx + dy * dy);
    }

    finishSelection(x, y) {
        if (!this.isSpawning && !this.isSelecting) return;

        const x1 = Math.min(this.start.x, this.end.x) - this.forest.x;
        const y1 = Math.min(this.start.y, this.end.y) - this.forest.y;
        const x2 = Math.max(this.start.x, this.end.x) - this.forest.x;
        const y2 = Math.max(this.start.y, this.end.y) - this.forest.y;

        // Add to HumanDataView selection (instead of replacing)
        const hdv = gameEngine.automata.datamanager.humanDataView;
        for (let human of gameEngine.automata.humans) {
            if (human.x >= x1 && human.x <= x2 && human.y >= y1 && human.y <= y2) {
                hdv.selectedHumans.add(human.id);
            }
        }
        hdv.syncSelection();

        this.start = null;
        this.end = null;
        this.isSelecting = false;
    }

    finishSpawn(x, y) {
        if (!this.isSpawning && !this.tempHuman) return;
        this.tempHuman.isSpawning = false;
        this.start = null;
        this.end = null;
        this.isSpawning = false;
        this.tempHuman = null;
    }

    draw(ctx) {
        if (this.isSelecting && this.start && this.end) {
            // Draw selection rectangle
            const x = Math.min(this.start.x, this.end.x);
            const y = Math.min(this.start.y, this.end.y);
            const w = Math.abs(this.end.x - this.start.x);
            const h = Math.abs(this.end.y - this.start.y);

            ctx.strokeStyle = "cyan";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, h);
        } else {
            // Highlight selected humans on the map
            const selected = gameEngine.automata.datamanager.humans_analyzed;
            if (selected.length === 0) return;

            for (let h of selected) {
                const cx = h.x + this.forest.x;
                const cy = h.y + this.forest.y;

                // Bright cyan circle
                ctx.strokeStyle = "rgba(0, 220, 255, 0.9)";
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(cx, cy, 12, 0, 2 * Math.PI);
                ctx.stroke();

                // Glow fill
                ctx.fillStyle = "rgba(0, 220, 255, 0.15)";
                ctx.beginPath();
                ctx.arc(cx, cy, 12, 0, 2 * Math.PI);
                ctx.fill();

                // Crosshair lines
                ctx.strokeStyle = "rgba(0, 220, 255, 0.5)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx - 16, cy);
                ctx.lineTo(cx - 6, cy);
                ctx.moveTo(cx + 6, cy);
                ctx.lineTo(cx + 16, cy);
                ctx.moveTo(cx, cy - 16);
                ctx.lineTo(cx, cy - 6);
                ctx.moveTo(cx, cy + 6);
                ctx.lineTo(cx, cy + 16);
                ctx.stroke();
            }
        }
    }
}
