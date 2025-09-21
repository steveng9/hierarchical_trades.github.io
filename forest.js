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
        // this.renderPixels(ctx);

        if (this.selectedTrade) {
            ctx.save();
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 2;

            for (let [key, value] of this.selectedTrade.trade_partners.entries()) {
                // key is something like "3-7"
                const [idA, idB] = key.split("-").map(Number);
                const h1 = gameEngine.automata.humanById.get(idA);
                const h2 = gameEngine.automata.humanById.get(idB);

                ctx.beginPath();
                ctx.moveTo(this.x + h1.x, this.y + h1.y);
                ctx.lineTo(this.x + h2.x, this.y + h2.y);
                ctx.stroke();
            }

            ctx.restore();
        }

    }

    selectTrade(trade) {
        this.selectedTrade = trade;

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