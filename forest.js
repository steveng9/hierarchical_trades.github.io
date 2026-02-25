class Forest {

    
    constructor() {
        assert(PARAMS.numResources > 0 && PARAMS.numResources <= 3, "numResources must be 1, 2, or 3");

        this.seeds = Array.from({length: PARAMS.numResources}, () => Math.random() * 40);

        this.x = PARAMS.margin;
        this.y = PARAMS.margin;
        // Number of cells horizontally/vertically
        this.cols = Math.ceil(PARAMS.forestwidth / PARAMS.cellSize);
        this.rows = Math.ceil(PARAMS.forestheight / PARAMS.cellSize);
        this.grid = [];
        this.selectedTrade = null;

        this.setConcentration();
        // this.setConcentrationRandomResource();
        // this.setConcentrationStripes();

        console.log(this)

    }


    update() {  

    }

  
    draw(ctx) {
        this.renderCells(ctx);

        if (this.selectedTrade) {
            this.drawTradeOverlay(ctx, this.selectedTrade);
        }
    }

    selectTrade(trade) {
        this.selectedTrade = trade;
    }

    drawTradeOverlay(ctx, trade) {
        const CONNECTION_COLORS = [
            "rgba(0, 0, 0, 0.7)",
            "rgba(30, 100, 255, 0.7)",
            "rgba(150, 0, 200, 0.7)",
            "rgba(0, 180, 0, 0.7)",
        ];
        const ORANGE = "rgba(255, 140, 0, 0.7)";
        const BLACK = CONNECTION_COLORS[0];

        ctx.save();

        // Clip all overlay drawing to the forest bounds
        ctx.beginPath();
        ctx.rect(this.x, this.y, PARAMS.forestwidth, PARAMS.forestheight);
        ctx.clip();

        // Build ancestor chain: [selected, parent, grandparent, ..., L1]
        const chain = [];
        let current = trade;
        while (current) {
            chain.push(current);
            if (!current.isHierarchical) break;
            current = current.parentTrade;
        }

        // Draw reach shading beneath everything else
        this.drawTradeReach(ctx, chain);

        if (chain.length === 1) {
            // L1 selected: draw partner pairs in black
            this.drawTradePairs(ctx, chain[0], BLACK);
        } else {
            // Draw L1 trade_pairs in orange (bottom layer)
            this.drawTradePairs(ctx, chain[chain.length - 1], ORANGE);

            // Draw connections from higher to lower, bottom-up so selected draws on top
            for (let i = chain.length - 2; i >= 0; i--) {
                const higherAgents = this.getTradeAgents(chain[i]);
                const lowerAgents = this.getTradeAgents(chain[i + 1]);
                const color = CONNECTION_COLORS[i] ?? CONNECTION_COLORS[CONNECTION_COLORS.length - 1];
                this.drawConnectionLines(ctx, higherAgents, lowerAgents, color);
            }
        }

        // Draw inventor markers for all trades in chain (top layer)
        for (let t of chain) {
            if (t.inventor && !t.inventor.removeFromWorld) {
                this.drawInventorMarker(ctx, t.inventor);
            }
        }

        ctx.restore();
    }

    // Returns Set<Human> of live agents participating at a given trade level
    getTradeAgents(trade) {
        const agents = new Set();
        if (!trade.isHierarchical) {
            // L1: collect unique live humans from trade_partners
            for (let key of trade.trade_partners.keys()) {
                const [idA, idB] = key.split("-").map(Number);
                const h1 = gameEngine.automata.humanById.get(idA);
                const h2 = gameEngine.automata.humanById.get(idB);
                if (h1 && !h1.removeFromWorld) agents.add(h1);
                if (h2 && !h2.removeFromWorld) agents.add(h2);
            }
        } else {
            // L2+: agents are those who have specifically invoked this trade
            for (let invoker of trade.invokers) {
                if (!invoker.removeFromWorld) agents.add(invoker);
            }
        }
        return agents;
    }

    // Draw L1 partner-pair lines with dark outline + color fill
    drawTradePairs(ctx, trade, fillColor) {
        const isBlack = fillColor === "rgba(0, 0, 0, 0.7)";

        for (let key of trade.trade_partners.keys()) {
            const [idA, idB] = key.split("-").map(Number);
            const h1 = gameEngine.automata.humanById.get(idA);
            const h2 = gameEngine.automata.humanById.get(idB);
            if (!h1 || !h2) continue;

            if (!isBlack) {
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x + h1.x, this.y + h1.y);
                ctx.lineTo(this.x + h2.x, this.y + h2.y);
                ctx.stroke();
            }

            ctx.strokeStyle = fillColor;
            ctx.lineWidth = isBlack ? 2 : 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x + h1.x, this.y + h1.y);
            ctx.lineTo(this.x + h2.x, this.y + h2.y);
            ctx.stroke();
        }
    }

    // Draw lines from each agent in agentsA to the centroid of agentsB
    drawConnectionLines(ctx, agentsA, agentsB, fillColor) {
        if (agentsB.size === 0) return;
        const isBlack = fillColor === "rgba(0, 0, 0, 0.7)";

        // Compute centroid of agentsB
        let cx = 0, cy = 0;
        for (let b of agentsB) { cx += b.x; cy += b.y; }
        cx = this.x + cx / agentsB.size;
        cy = this.y + cy / agentsB.size;

        for (let a of agentsA) {
            if (!isBlack) {
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x + a.x, this.y + a.y);
                ctx.lineTo(cx, cy);
                ctx.stroke();
            }

            ctx.strokeStyle = fillColor;
            ctx.lineWidth = isBlack ? 2 : 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x + a.x, this.y + a.y);
            ctx.lineTo(cx, cy);
            ctx.stroke();
        }
    }

    // Shade the geographic reach of the selected trade.
    // Visibility is permanent: a region unlocked by a (now-dead) inventor or manager stays unlocked.
    drawTradeReach(ctx, chain) {
        const selected = chain[0];
        if (!selected.inventor) return;

        // Draw full reach union (inventor + all ever-added managers) in light gold.
        // No removeFromWorld filter — dead inventors/managers still define permanent visibility.
        const offscreen = document.createElement('canvas');
        offscreen.width = ctx.canvas.width;
        offscreen.height = ctx.canvas.height;
        const octx = offscreen.getContext('2d');

        octx.fillStyle = 'rgba(255, 220, 80, 1)';
        octx.beginPath();
        octx.arc(this.x + selected.inventor.x, this.y + selected.inventor.y, selected.inventor.socialReach, 0, 2 * Math.PI);
        octx.fill();
        for (let manager of selected.managers) {
            octx.beginPath();
            octx.arc(this.x + manager.x, this.y + manager.y, manager.socialReach, 0, 2 * Math.PI);
            octx.fill();
        }

        ctx.globalAlpha = 0.25;
        ctx.drawImage(offscreen, 0, 0);
        ctx.globalAlpha = 1.0;

        // Dashed ring on the inventor's original circle — anything outside this ring
        // is manager-extended visibility
        ctx.strokeStyle = 'rgba(255, 120, 0, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(this.x + selected.inventor.x, this.y + selected.inventor.y, selected.inventor.socialReach, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw inventor as a diamond marker
    drawInventorMarker(ctx, human) {
        this.drawMarker(ctx, human, "rgba(0, 180, 0, 0.9)", 11);

        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.font = "10px monospace";
        ctx.textBaseline = "bottom";
        ctx.fillText("inv", this.x + human.x + 10, this.y + human.y - 4);
    }

    // Draw a diamond-shaped marker at a human's position
    drawMarker(ctx, human, color, size) {
        const cx = this.x + human.x;
        const cy = this.y + human.y;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy);
        ctx.lineTo(cx, cy + size);
        ctx.lineTo(cx - size, cy);
        ctx.closePath();
        ctx.fill();
    }

    setConcentrationRandomResource() {
        // Each cell has concentrations for each resource
        for (let i = 0; i < this.rows; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.cols; j++) {
                const cell = new Array(3).fill(0);
                cell[randomInt(PARAMS.numResources)] = 1;
                this.grid[i][j] = cell;
            }
        }

    }

    
    setConcentrationStripes() {
        // Each cell has concentrations for each resource
        for (let i = 0; i < this.rows; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.cols; j++) {
                const cell = new Array(3).fill(0);
                cell[Math.floor(j/2) % 3] = 1;
                this.grid[i][j] = cell;
            }
        }

    }

    setConcentration() {
        // Each cell has concentrations for each resource
        for (let i = 0; i < this.rows; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.cols; j++) {
                let cell = new Array(3).fill(0);
                for (let r = 0; r < PARAMS.numResources; r++) {
                    cell[r] = ((Math.max(this.setCellConcentration(j, i, r) - PARAMS.undulation_cutuff, 0))/(1-PARAMS.undulation_cutuff));
                    // break;
                }
                this.grid[i][j] = cell;
            }
        }

    }

    setCellConcentration(j, i, resourceIndex) {
        let hs = [];
        for (let y = i * PARAMS.cellSize; y < (i+1) * PARAMS.cellSize; y++) {
            for (let x = j * PARAMS.cellSize; x < (j+1) * PARAMS.cellSize; x++) {
                hs.push(this.wavyNoise(x, y, this.seeds[resourceIndex]));
            }
        }
        return average(hs);
    }
    

    wavyNoise(x, y, seed) {
        x *= PARAMS.roughness;
        y *= PARAMS.roughness;
        // Rotate coordinates a bit to avoid grid-like artifacts
        const angle = 0.36; // tweak for more/less diagonals
        const xr = x * Math.cos(angle) - y * Math.sin(angle);
        const yr = x * Math.sin(angle) + y * Math.cos(angle);

        // Combine a few sine waves with irrational frequency ratios
        let v = 0;
        v += Math.sin(xr * 0.013 + seed) * 0.7;
        v += Math.sin(yr * 0.021 + seed * 1.3) * 0.5;
        v += Math.sin((xr + yr) * 0.017 + seed * 2.1) * 0.3;
        v += Math.sin((xr - yr) * 0.011 + seed * 3.7) * 0.2;

        // Normalize back to 0–1 range
        return (v + 1.7) / 3.4;
    }



    // Get concentration of a resource at pixel coordinate (x,y)
    getConcentration(x, y, resourceIndex) {
        const col = Math.floor(x / PARAMS.cellSize);
        const row = Math.floor(y / PARAMS.cellSize);

        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return 0; // out of bounds
        }
        return this.grid[row][col][resourceIndex];
    }

    renderCells(ctx) {
        
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const x = j * PARAMS.cellSize;
                const y = i * PARAMS.cellSize;
                const cell = this.grid[i][j];
                ctx.fillStyle = `rgb(${Math.floor(cell[0] * 255)}, ${Math.floor(cell[1] * 255)}, ${Math.floor(cell[2] * 255)})`;
                ctx.fillRect(this.x + x, this.y + y, PARAMS.cellSize, PARAMS.cellSize);
            }
        }
    }

}