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
        ctx.save();

        if (trade.isHierarchical) {
            this.drawHierarchicalTradeOverlay(ctx, trade);
        } else {
            this.drawLevel1TradeOverlay(ctx, trade);
        }

        ctx.restore();
    }

    // Level-1: lines between trade partners (existing behavior)
    drawLevel1TradeOverlay(ctx, trade) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 2;

        for (let [key] of trade.trade_partners.entries()) {
            const [idA, idB] = key.split("-").map(Number);
            const h1 = gameEngine.automata.humanById.get(idA);
            const h2 = gameEngine.automata.humanById.get(idB);

            if (h1 && h2) {
                ctx.beginPath();
                ctx.moveTo(this.x + h1.x, this.y + h1.y);
                ctx.lineTo(this.x + h2.x, this.y + h2.y);
                ctx.stroke();
            }
        }

        // Highlight inventor with a diamond
        if (trade.inventor && !trade.inventor.removeFromWorld) {
            this.drawInventorMarker(ctx, trade.inventor);
        }

        // If this trade has managers (via a level-2 trade), show them
        if (trade.managers.size > 0) {
            this.drawManagers(ctx, trade);
        }
    }

    // Level-2+: show managers, parent trade network, and management lines
    drawHierarchicalTradeOverlay(ctx, trade) {
        const parentTrade = trade.parentTrade;

        // 1) Draw the parent trade's partner network (faded context lines, dark outline for legibility)
        if (parentTrade) {
            for (let [key] of parentTrade.trade_partners.entries()) {
                const [idA, idB] = key.split("-").map(Number);
                const h1 = gameEngine.automata.humanById.get(idA);
                const h2 = gameEngine.automata.humanById.get(idB);
                if (!h1 || !h2) continue;

                // Dark outline
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x + h1.x, this.y + h1.y);
                ctx.lineTo(this.x + h2.x, this.y + h2.y);
                ctx.stroke();

                // Orange fill on top
                ctx.strokeStyle = "rgba(255, 140, 0, 0.7)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(this.x + h1.x, this.y + h1.y);
                ctx.lineTo(this.x + h2.x, this.y + h2.y);
                ctx.stroke();
            }

            // Draw parent trade's inventor (orange diamond)
            if (parentTrade.inventor && !parentTrade.inventor.removeFromWorld) {
                this.drawMarker(ctx, parentTrade.inventor, "rgba(255, 140, 0, 1.0)", 8);
            }
        }

        // 2) Draw this trade's own partner lines (bright blue, outlined)
        for (let [key] of trade.trade_partners.entries()) {
            const [idA, idB] = key.split("-").map(Number);
            const h1 = gameEngine.automata.humanById.get(idA);
            const h2 = gameEngine.automata.humanById.get(idB);
            if (!h1 || !h2) continue;

            ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(this.x + h1.x, this.y + h1.y);
            ctx.lineTo(this.x + h2.x, this.y + h2.y);
            ctx.stroke();

            ctx.strokeStyle = "rgba(30, 140, 255, 1.0)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x + h1.x, this.y + h1.y);
            ctx.lineTo(this.x + h2.x, this.y + h2.y);
            ctx.stroke();
        }

        // 3) Dashed manager → parent inventor lines
        if (parentTrade) {
            this.drawManagers(ctx, parentTrade);

            if (parentTrade.inventor && !parentTrade.inventor.removeFromWorld) {
                const inv = parentTrade.inventor;
                ctx.setLineDash([6, 4]);

                for (let manager of parentTrade.managers) {
                    if (manager.removeFromWorld) continue;

                    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(this.x + manager.x, this.y + manager.y);
                    ctx.lineTo(this.x + inv.x, this.y + inv.y);
                    ctx.stroke();

                    ctx.strokeStyle = "rgba(30, 140, 255, 1.0)";
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(this.x + manager.x, this.y + manager.y);
                    ctx.lineTo(this.x + inv.x, this.y + inv.y);
                    ctx.stroke();
                }

                ctx.setLineDash([]);
            }
        }

        // 4) Highlight this trade's inventor
        if (trade.inventor && !trade.inventor.removeFromWorld) {
            this.drawInventorMarker(ctx, trade.inventor);
        }
    }

    // Draw managers as orange circles
    drawManagers(ctx, trade) {
        ctx.strokeStyle = "rgba(255, 140, 0, 0.8)";
        ctx.lineWidth = 2;

        for (let manager of trade.managers) {
            if (manager.removeFromWorld) continue;
            ctx.beginPath();
            ctx.arc(this.x + manager.x, this.y + manager.y, 10, 0, 2 * Math.PI);
            ctx.stroke();

            // Label
            ctx.fillStyle = "rgba(255, 140, 0, 0.9)";
            ctx.font = "10px monospace";
            ctx.textBaseline = "bottom";
            ctx.fillText("mgr", this.x + manager.x + 12, this.y + manager.y - 2);
        }
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