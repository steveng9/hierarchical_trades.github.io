/**
 * Shared pan/zoom state for a group of time-series graphs and histograms that should stay
 * lined up with each other — a single TimeViewport instance is passed to every Graph and
 * Histogram in the group, so dragging any one of them moves them all in lockstep.
 *
 * State lives in "tick" units (one unit per collection sample), not raw array indices,
 * because different series can have different array lengths for the same span of history
 * (Graph seeds each series with a leading `[0]` so its first draw always has >1 point;
 * Histogram doesn't). Each caller converts its own array indices to/from tick units.
 */
const MIN_STRIDE = 1;
const MAX_STRIDE = 100;
export const FF_BAR_WIDTH = 8;   // fast-forward affordance, at the right edge when not live

export class TimeViewport {
    constructor() {
        // Exclusive tick index at the right edge of what's drawn. null = always show the
        // live edge — the historical default. Once the user drags, it pins to a fixed tick
        // until they hit the fast-forward bar.
        this.viewEnd = null;
        // Ticks per pixel-column. 1 = one sample per pixel; higher values decimate more
        // history into the same width (shift-drag zoom).
        this.zoomStride = 1;

        this._dragging = false;
        this._dragMode = null;      // 'pan' | 'zoom'
        this._dragStartX = 0;
        this._dragBaseViewEnd = 0;
        this._dragBaseStride = 1;
    }

    get isLive() {
        return this.viewEnd === null;
    }

    /** [start, end) tick range visible for a series with `realLength` collected ticks,
     * drawn `xSize` pixels wide. */
    visibleRange(realLength, xSize) {
        const end = Math.min(this.viewEnd ?? realLength, realLength);
        const start = Math.max(0, end - xSize * this.zoomStride);
        return {start, end, stride: this.zoomStride};
    }

    /** Call once a caller has confirmed the mousedown point is inside its own bounds and,
     * if relevant, not on its own fast-forward bar. */
    beginDrag(x, shiftKey, realLength) {
        this._dragging = true;
        this._dragMode = shiftKey ? 'zoom' : 'pan';
        this._dragBaseViewEnd = this.viewEnd ?? realLength;
        this._dragBaseStride = this.zoomStride;
        this._dragStartX = x;
        if (this._dragMode === 'zoom') this.viewEnd = null;   // zoom stays pinned to live
    }

    drag(x, realLength, xSize) {
        if (!this._dragging) return;
        const dx = x - this._dragStartX;

        if (this._dragMode === 'zoom') {
            this.zoomStride = Math.max(MIN_STRIDE, Math.min(MAX_STRIDE, Math.round(this._dragBaseStride + dx / 15)));
            this.viewEnd = null;
            return;
        }

        // Pan: dragging right reveals the past (viewEnd decreases), dragging left returns
        // toward the live edge (viewEnd increases, capped there).
        const minEnd = Math.min(realLength, xSize * this.zoomStride);
        const shiftSamples = Math.round(dx * this.zoomStride);
        this.viewEnd = Math.max(minEnd, Math.min(realLength, this._dragBaseViewEnd - shiftSamples));
    }

    endDrag() {
        this._dragging = false;
        this._dragMode = null;
    }

    fastForward() {
        this.viewEnd = null;
    }
}

/** Thin blue bar + right-pointing arrow at a graph's right edge: click to jump back to live.
 * Shared by Graph and Histogram so the affordance looks and behaves identically. */
export function drawFastForward(ctx, x, y, xSize, ySize, behindTicks) {
    const barX = x + xSize - FF_BAR_WIDTH;
    ctx.fillStyle = "rgba(30, 100, 220, 0.55)";
    ctx.fillRect(barX, y, FF_BAR_WIDTH, ySize);

    const cy = y + ySize / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(barX + 2, cy - 5);
    ctx.lineTo(barX + 2, cy + 5);
    ctx.lineTo(barX + FF_BAR_WIDTH - 2, cy);
    ctx.closePath();
    ctx.fill();

    if (behindTicks > 0) {
        ctx.fillStyle = "#1e4bdc";
        ctx.textAlign = "right";
        ctx.font = "10px monospace";
        ctx.fillText(`-${behindTicks}`, barX - 2, y + 10);
    }
}
