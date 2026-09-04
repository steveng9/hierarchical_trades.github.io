/**
 * Time-histogram: a scrolling heatmap where each column is one collection tick and each row
 * is a value bin. Brightness encodes that bin's share of the population at that tick.
 *
 * Ported from the pre-refactor `attic/histogram.js` (kept for its log-scaled colour style),
 * generalized to any bin count and freed of its broken `./colors.js` import.
 */
import {PARAMS, gameEngine} from '../browser/context.js';
import {TimeViewport, FF_BAR_WIDTH, drawFastForward} from './timeviewport.js';

export class Histogram {
    constructor(x, y, data, label, xSize = 600, ySize = 100, binCount = 20, viewport = null) {
        this.x = x;
        this.y = y;
        this.data = data;   // array of per-tick bin-count arrays, oldest first
        this.label = label;
        this.xSize = xSize;
        this.ySize = ySize;
        this.binCount = binCount;
        this.ctx = gameEngine.ctx;

        // Pan/zoom state, in tick units. Shared across every Graph/Histogram passed the same
        // instance, so dragging one moves them all in lockstep — see timeviewport.js.
        this.viewport = viewport ?? new TimeViewport();
    }

    update() {}

    containsPoint(x, y) {
        return x >= this.x && x <= this.x + this.xSize && y >= this.y && y <= this.y + this.ySize;
    }

    get _isLive() {
        return this.viewport.isLive;
    }

    handleMouseDown(x, y, shiftKey) {
        if (!this.containsPoint(x, y)) return false;

        if (!this._isLive && x >= this.x + this.xSize - FF_BAR_WIDTH) {
            this.viewport.fastForward();
            return false;
        }

        this.viewport.beginDrag(x, shiftKey, this.data.length);
        return true;
    }

    handleMouseMove(x) {
        this.viewport.drag(x, this.data.length, this.xSize);
    }

    handleMouseUp() {
        this.viewport.endDrag();
    }

    draw(ctx) {
        this.ctx.save();

        const {start, end, stride} = this.viewport.visibleRange(this.data.length, this.xSize);
        const rowHeight = this.ySize / this.binCount;

        let col = 0;
        for (let idx = start; idx < end; idx += stride) {
            const counts = this.data[idx];
            const total = counts.reduce((a, b) => a + b, 0);
            if (total > 0) {
                for (let bin = 0; bin < counts.length; bin++) {
                    if (counts[bin] === 0) continue;
                    this.fillCell(col, bin, counts[bin] / total, rowHeight);
                }
            }
            col++;
        }

        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);

        this.ctx.fillStyle = '#000000';
        this.ctx.textAlign = 'center';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(this.label, this.x + this.xSize / 2, this.y + this.ySize + 12);

        if (!this._isLive) drawFastForward(this.ctx, this.x, this.y, this.xSize, this.ySize, (this.data.length - end) * PARAMS.reportingPeriod);

        this.ctx.restore();
    }

    /**
     * White (empty bin) fading through blue to near-black (this bin holds nearly everyone),
     * log-scaled so a small-but-nonzero share still reads as visibly present rather than
     * washed out — the same curve attic/histogram.js used.
     */
    fillCell(col, bin, share, rowHeight) {
        let c = 511 - Math.floor(Math.log(share * 99 + 1) / Math.log(100) * 512);
        this.ctx.fillStyle = c > 255 ? `rgb(${c - 256},${c - 256},255)` : `rgb(0,0,${Math.max(0, c)})`;
        const row = this.binCount - 1 - bin;   // bin 0 at the bottom
        this.ctx.fillRect(this.x + col, this.y + row * rowHeight, 1, Math.ceil(rowHeight));
    }
}
