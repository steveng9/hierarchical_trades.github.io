import {PARAMS} from '../browser/context.js';

const PI = Math.PI;
const LOG_MAX = Math.log10(2000);
const ARC_START = 0.75 * PI;
const ARC_SWEEP = 1.5 * PI;

const TICKS = [1, 10, 100, 1000, 2000];
const SEGMENTS = [
    {from: 0, to: Math.log10(30)  / LOG_MAX, color: '#e74c3c'},
    {from: Math.log10(30)  / LOG_MAX, to: Math.log10(300) / LOG_MAX, color: '#f39c12'},
    {from: Math.log10(300) / LOG_MAX, to: 1, color: '#27ae60'},
];

export class VariableViewer {
    constructor(x, y, label, variableGetter, options = {}) {
        this.x = x;
        this.y = y;
        this.label = label;
        this.variableGetter = variableGetter;
        this.speedGetter = options.speedGetter || null;
        this.xSize = PARAMS.leftpanelWidth;
        this.ySize = this.speedGetter ? 170 : 140;
    }

    update() {}

    draw(ctx) {
        ctx.save();

        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);

        ctx.fillStyle = "#000";
        ctx.textAlign = "left";
        ctx.font = "13px monospace";

        const lineHeight = 18;
        let drawX = this.x + 10;
        let drawY = this.y + 18;

        const variables = this.variableGetter();
        for (let [key, value] of Object.entries(variables)) {
            ctx.fillText(`${key}: ${value}`, drawX, drawY);
            drawY += lineHeight;

            if (drawY > this.y + this.ySize - 10) {
                drawY = this.y + 18;
                drawX += 250;
            }
        }

        if (this.speedGetter) this.drawSpeedometer(ctx);

        ctx.restore();
    }

    drawSpeedometer(ctx) {
        const speed = Math.max(1, this.speedGetter());
        const t = Math.min(1, Math.log10(speed) / LOG_MAX);

        const cx = this.x + 340;
        const cy = this.y + 125;
        const r = 38;

        for (const seg of SEGMENTS) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, ARC_START + seg.from * ARC_SWEEP, ARC_START + seg.to * ARC_SWEEP, false);
            ctx.strokeStyle = seg.color;
            ctx.lineWidth = 6;
            ctx.stroke();
        }

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        for (const val of TICKS) {
            const tf = Math.log10(val) / LOG_MAX;
            const angle = ARC_START + tf * ARC_SWEEP;
            const cos = Math.cos(angle), sin = Math.sin(angle);
            ctx.beginPath();
            ctx.moveTo(cx + (r - 8) * cos, cy + (r - 8) * sin);
            ctx.lineTo(cx + (r + 2) * cos, cy + (r + 2) * sin);
            ctx.stroke();

            ctx.fillStyle = '#333';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const label = val >= 1000 ? (val / 1000) + 'K' : String(val);
            ctx.fillText(label, cx + (r + 12) * cos, cy + (r + 12) * sin);
        }

        const needleAngle = ARC_START + t * ARC_SWEEP;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (r - 10) * Math.cos(needleAngle), cy + (r - 10) * Math.sin(needleAngle));
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, 2 * PI);
        ctx.fillStyle = '#111';
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(Math.round(speed) + ' gen/s', cx, cy + 10);
    }
}
