import {PARAMS, gameEngine} from '../browser/context.js';
import {TimeViewport, FF_BAR_WIDTH, drawFastForward} from './timeviewport.js';

export class Graph {
    constructor(x, y, data, label, sublabels = [], horizantal_lines = [], xSize = 1160, ySize = 115, dashed = [], viewport = null) {
        this.x = x;
        this.y = y;
        this.data = data;
        this.label = label;
        this.sublabels = sublabels;

        this.xSize = xSize;
        this.ySize = ySize;
        this.ctx = gameEngine.ctx;
        this.colors = ["#00BB00", "#BB0000", "#00BBBB", "#CCCCCC"];
        this.maxVal = 0;
        this.horizantal_lines = horizantal_lines;
        this.fill = false;
        // Per-series dash pattern: dashed[j] true draws series j as a dashed line.
        this.dashed = dashed;

        // Pan/zoom state, in tick units. Shared across every Graph/Histogram passed the same
        // instance, so dragging one moves them all in lockstep — see timeviewport.js.
        this.viewport = viewport ?? new TimeViewport();
    }

    update() {
    }

    _dataLength() {
        return this.data[0].length;
    }

    // Series are seeded with a leading [0] so the first draw always has >1 point (see
    // StatsPanel/HistogramPanel). That seed isn't a real collected tick, so the tick-unit
    // range used by the shared viewport excludes it.
    _realLength() {
        return this._dataLength() - 1;
    }

    containsPoint(x, y) {
        return x >= this.x && x <= this.x + this.xSize && y >= this.y && y <= this.y + this.ySize;
    }

    get _isLive() {
        return this.viewport.isLive;
    }

    /** @returns {boolean} true if this started a drag (caller should route subsequent move/up here) */
    handleMouseDown(x, y, shiftKey) {
        if (!this.containsPoint(x, y)) return false;

        if (!this._isLive && x >= this.x + this.xSize - FF_BAR_WIDTH) {
            this.viewport.fastForward();
            return false;
        }

        this.viewport.beginDrag(x, shiftKey, this._realLength());
        return true;
    }

    handleMouseMove(x) {
        this.viewport.drag(x, this._realLength(), this.xSize);
    }

    handleMouseUp() {
        this.viewport.endDrag();
    }

    /** [start, end) sample range currently visible, and the stride between plotted samples,
     * translated from the shared viewport's tick units into this series' array indices. */
    _visibleRange() {
        const {start, end, stride} = this.viewport.visibleRange(this._realLength(), this.xSize);
        return {start: start + 1, end: end + 1, stride};
    }

    draw(ctx) {
        this.ctx.save();
        const {start, end, stride} = this._visibleRange();
        this.updateMax(start, end);

        let lastYPos = this.y + this.ySize;
        if (end - start > 1) {
            for (let j = 0; j < this.data.length; j++) {
                const series = this.data[j];

                this.ctx.strokeStyle = this.colors[j];
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash(this.dashed[j] ? [6, 4] : []);

                this.ctx.beginPath();
                let plotted = 0;
                for (let idx = start; idx < end; idx += stride) {
                    const xPos = this.x + plotted;
                    let yPos = this.y + this.ySize - Math.floor(series[idx] / this.maxVal * this.ySize);
                    if (yPos <= 0) yPos = 0;
                    if (plotted === 0) this.ctx.moveTo(xPos, yPos);
                    else this.ctx.lineTo(xPos, yPos);
                    lastYPos = yPos;
                    plotted++;
                }
                this.ctx.stroke();
                this.ctx.closePath();

                this.ctx.strokeStyle = "#000000";
                this.ctx.fillStyle = "#000000";
                this.ctx.textAlign = "right";
                this.ctx.fillText(series[end - 1], this.x + this.xSize - 5, lastYPos + 10);
                if (this.sublabels.length > 0) {
                    this.ctx.strokeStyle = this.colors[j];
                    this.ctx.fillStyle = this.colors[j];
                    this.ctx.fillText(this.sublabels[j], this.x + this.xSize - 5, lastYPos + 20);
                }
            }
        }
        this.ctx.setLineDash([]);

        this.ctx.fillStyle = "#000000";
        this.ctx.textAlign = "left";
        this.ctx.fillText(start * PARAMS.reportingPeriod, this.x + 5, this.y + this.ySize + 10);
        this.ctx.textAlign = "right";
        this.ctx.fillText(Math.max(0, end - 1) * PARAMS.reportingPeriod, this.x + this.xSize - 5, this.y + this.ySize + 10);
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.label, this.x + this.xSize / 2, this.y + this.ySize + 12);
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);

        this.horizantal_lines.forEach(([label, hLine]) => {
            this.ctx.strokeStyle = "#FF0000";
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            let yCanvas = this.y + this.ySize - Math.floor(hLine / this.maxVal * this.ySize);
            if (yCanvas < this.y) yCanvas = this.y;

            this.ctx.beginPath();
            this.ctx.moveTo(this.x, yCanvas);
            this.ctx.lineTo(this.x + this.xSize, yCanvas);
            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.setLineDash([]);

            this.ctx.fillStyle = "#FF0000";
            this.ctx.textAlign = "left";
            this.ctx.font = "12px Arial";
            this.ctx.fillText(label, this.x + 5, Math.max(yCanvas - 5, this.y + 5));
        });

        if (!this._isLive) drawFastForward(this.ctx, this.x, this.y, this.xSize, this.ySize, (this._dataLength() - end) * PARAMS.reportingPeriod);

        this.ctx.restore();
    }

    updateMax(start, end) {
        if (start === undefined) { start = 0; end = this._dataLength(); }
        let max = 1;
        for (const series of this.data) {
            for (let i = start; i < end; i++) {
                if (series[i] > max) max = series[i];
            }
        }
        this.maxVal = max;
    }
}
