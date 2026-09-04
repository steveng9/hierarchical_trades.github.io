/**
 * Agent rendering. Extracted from `Human.draw`, which used to couple the agent model to a
 * canvas context.
 */
import {PARAMS, gameEngine} from '../browser/context.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../core/human.js').Human} human
 * @param {{x:number,y:number}} origin  the forest view's top-left corner
 */
export function drawHuman(ctx, human, origin) {
    const color = human.isSpawning ? 'yellow' : '#FFFFFF';
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(origin.x + human.x, origin.y + human.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    if (PARAMS.show_social_reach) {
        ctx.beginPath();
        ctx.arc(origin.x + human.x, origin.y + human.y, human.socialReach, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.closePath();
    }

    const selected = gameEngine.automata?.datamanager?.humanDataView?.selectedHumans;
    if (selected?.has(human.id)) {
        ctx.font = '12px monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(`H${human.id}`, origin.x + human.x + 8, origin.y + human.y);
    }
}
