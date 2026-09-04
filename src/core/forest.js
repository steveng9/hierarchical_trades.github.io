/**
 * The resource landscape.
 *
 * Pure simulation state: a grid of per-cell resource concentrations, plus depletion and
 * regrowth. All rendering — cell colouring, trade overlays, reach shading — lives in
 * `src/render/forestview.js` and reads this object without mutating it.
 */
import {getTerrainGenerator} from '../mechanics/terrain.js';

export class Forest {
    /**
     * @param {import('./simulation.js').Simulation} sim
     * @param {string} [terrain] generator name; defaults to the scenario's choice
     */
    constructor(sim, terrain = 'wavy') {
        this.sim = sim;
        const params = sim.params;

        this.cols = Math.ceil(params.forestwidth / params.cellSize);
        this.rows = Math.ceil(params.forestheight / params.cellSize);
        this.terrainName = terrain;

        this.grid = getTerrainGenerator(terrain)({
            rows: this.rows,
            cols: this.cols,
            params,
            rng: sim.rng,
        });

        // Regrowth target. Deep copy: cells must not alias the live grid.
        this.baseGrid = this.grid.map(row => row.map(cell => [...cell]));
    }

    /** Regrow every depleted cell toward its baseline. No-op when depletion is disabled. */
    update() {
        const params = this.sim.params;
        if (!params.resourceDepletion) return;
        const rate = params.resourceRegenRate;
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const cell = this.grid[i][j];
                const base = this.baseGrid[i][j];
                for (let r = 0; r < params.numResources; r++) {
                    if (cell[r] < base[r]) {
                        cell[r] = Math.min(cell[r] + rate, base[r]);
                    }
                }
            }
        }
    }

    /** Reduce a cell's concentration in proportion to what was harvested from it. */
    depleteCell(x, y, resourceIndex, amount) {
        const params = this.sim.params;
        const col = Math.floor(x / params.cellSize);
        const row = Math.floor(y / params.cellSize);
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
        this.grid[row][col][resourceIndex] = Math.max(
            0,
            this.grid[row][col][resourceIndex] - amount * params.resourceDepletionRate
        );
    }

    /** Concentration of one resource at a pixel coordinate. 0 outside the world. */
    getConcentration(x, y, resourceIndex) {
        const params = this.sim.params;
        const col = Math.floor(x / params.cellSize);
        const row = Math.floor(y / params.cellSize);
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
        return this.grid[row][col][resourceIndex];
    }

    /**
     * Sum current and undepleted-ceiling concentration per resource, restricted to `cells`
     * (an iterable of [row, col] pairs) — or the whole grid when `cells` is omitted.
     */
    resourceTotals(numResources, cells) {
        const now = Array(numResources).fill(0);
        const max = Array(numResources).fill(0);
        const accumulate = (row, col) => {
            for (let r = 0; r < numResources; r++) {
                now[r] += this.grid[row][col][r];
                max[r] += this.baseGrid[row][col][r];
            }
        };
        if (cells) {
            for (const [row, col] of cells) accumulate(row, col);
        } else {
            for (let i = 0; i < this.rows; i++) {
                for (let j = 0; j < this.cols; j++) accumulate(i, j);
            }
        }
        return {now, max};
    }
}
