/**
 * Grid-based spatial index for fast neighbor queries.
 *
 * Agents never move, so the grid only updates on insert (birth) and remove (death).
 * Turns humansWithinReach from O(n) to O(k) where k is the local population.
 */
import {wrapDelta} from './mathutil.js';

export class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
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

    /**
     * @param {{width: number, height: number}} [wrap]  when given, also considers neighbours
     *   across the map edge (left-right, top-bottom) and measures distance toroidally.
     */
    query(x, y, radius, wrap) {
        const r2 = radius * radius;
        let minCol = Math.floor((x - radius) / this.cellSize);
        let maxCol = Math.floor((x + radius) / this.cellSize);
        let minRow = Math.floor((y - radius) / this.cellSize);
        let maxRow = Math.floor((y + radius) / this.cellSize);
        if (wrap) {
            // Cap the span at one full lap so a radius wider than the map doesn't visit a cell twice.
            maxCol = Math.min(maxCol, minCol + this.cols - 1);
            maxRow = Math.min(maxRow, minRow + this.rows - 1);
        } else {
            minCol = Math.max(0, minCol);
            maxCol = Math.min(this.cols - 1, maxCol);
            minRow = Math.max(0, minRow);
            maxRow = Math.min(this.rows - 1, maxRow);
        }
        const result = [];
        for (let row = minRow; row <= maxRow; row++) {
            const r = wrap ? ((row % this.rows) + this.rows) % this.rows : row;
            for (let col = minCol; col <= maxCol; col++) {
                const c = wrap ? ((col % this.cols) + this.cols) % this.cols : col;
                const cell = this.cells[r * this.cols + c];
                for (let i = 0; i < cell.length; i++) {
                    const agent = cell[i];
                    let dx = agent.x - x;
                    let dy = agent.y - y;
                    if (wrap) {
                        dx = wrapDelta(dx, this.width);
                        dy = wrapDelta(dy, this.height);
                    }
                    if (dx * dx + dy * dy < r2) result.push(agent);
                }
            }
        }
        return result;
    }
}
