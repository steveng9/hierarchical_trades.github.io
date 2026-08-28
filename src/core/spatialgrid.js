/**
 * Grid-based spatial index for fast neighbor queries.
 *
 * Agents never move, so the grid only updates on insert (birth) and remove (death).
 * Turns humansWithinReach from O(n) to O(k) where k is the local population.
 */
export class SpatialGrid {
    constructor(width, height, cellSize) {
        this.cellSize = cellSize;
        this.cols = Math.max(1, Math.ceil(width / cellSize));
        this.rows = Math.max(1, Math.ceil(height / cellSize));
        this.cells = new Array(this.cols * this.rows);
        for (let i = 0; i < this.cells.length; i++) this.cells[i] = [];
    }

    _index(x, y) {
        const col = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize)));
        const row = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)));
        return row * this.cols + col;
    }

    insert(agent) {
        this.cells[this._index(agent.x, agent.y)].push(agent);
    }

    remove(agent) {
        const cell = this.cells[this._index(agent.x, agent.y)];
        const i = cell.indexOf(agent);
        if (i >= 0) {
            cell[i] = cell[cell.length - 1];
            cell.pop();
        }
    }

    query(x, y, radius) {
        const r2 = radius * radius;
        const minCol = Math.max(0, Math.floor((x - radius) / this.cellSize));
        const maxCol = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
        const minRow = Math.max(0, Math.floor((y - radius) / this.cellSize));
        const maxRow = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));
        const result = [];
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const cell = this.cells[row * this.cols + col];
                for (let i = 0; i < cell.length; i++) {
                    const agent = cell[i];
                    const dx = agent.x - x;
                    const dy = agent.y - y;
                    if (dx * dx + dy * dy < r2) result.push(agent);
                }
            }
        }
        return result;
    }
}
