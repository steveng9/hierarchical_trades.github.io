class SelectionManager {
    constructor() {
        this.start = null;
        this.end = null;

        this.isSpawning = false;
        this.isSelecting = false;
        this.tempHuman = null;
    }

    beginSelection(x, y) {
        this.isSelecting = true;
        this.start = { x, y };
        this.end = { x, y };
    }

    beginSpawn(x, y) {
        this.start = { x, y };
        this.end = { x, y };
        this.isSpawning = true;
        this.isSelecting = false;
        this.tempHuman = new Human({x: x, y: y, reach: 0, isSpawning: true});
        gameEngine.automata.add_human(this.tempHuman);
    }

    updateSelection(x, y) {
        if (!this.isSelecting) return;
        this.end = { x, y };
    }

    updateSpawn(x, y) {
        if (!this.isSpawning || !this.tempHuman) return;
        this.end = { x, y };
        // Calculate social reach as distance
        const dx = this.end.x - this.start.x;
        const dy = this.end.y - this.start.y;
        const reach = Math.sqrt(dx * dx + dy * dy);
        this.tempHuman.socialReach = reach;
    }

    finishSelection(x, y) {
        if (!this.isSpawning && !this.isSelecting) return;

        // Rectangle boundaries
        const x1 = Math.min(this.start.x, this.end.x);
        const y1 = Math.min(this.start.y, this.end.y);
        const x2 = Math.max(this.start.x, this.end.x);
        const y2 = Math.max(this.start.y, this.end.y);

        gameEngine.automata.datamanager.analyze_humans_in(x1, x2, y1, y2);

        // Reset state
        this.start = null;
        this.end = null;
        this.isSelecting = false;

    }

    finishSpawn(x, y) {
        if (!this.isSpawning && !this.tempHuman) return;
        
        this.tempHuman.isSpawning = false;
        
        // Reset state
        this.start = null;
        this.end = null;
        this.isSpawning = false;
        this.tempHuman = null;
    }

    draw(ctx) {
        if (this.isSelecting && this.start && this.end) {
            const x = Math.min(this.start.x, this.end.x);
            const y = Math.min(this.start.y, this.end.y);
            const w = Math.abs(this.end.x - this.start.x);
            const h = Math.abs(this.end.y - this.start.y);

            ctx.strokeStyle = "cyan";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, y, w, h);

        } else {
            // Highlight selected humans
            ctx.strokeStyle = "yellow";
            for (let h of gameEngine.automata.datamanager.humans_analyzed) {
                ctx.beginPath();
                ctx.arc(h.x, h.y, 8, 0, 2 * Math.PI);
                ctx.stroke();
            }
        }


    }
}