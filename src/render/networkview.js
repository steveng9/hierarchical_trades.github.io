/**
 * Network overlay for the pairwise exchange: the social graph, or the flow of one resource
 * across it.
 *
 * Modes:
 *   'off'       nothing drawn
 *   'topology'  every link, dark on a pale halo so it reads over any terrain
 *   r (number)  only links that recently carried resource r, in r's forest colour, width
 *               growing with log(1 + recent flow), with an arrowhead showing net direction
 *               where the flow is mostly one-way
 *
 * "Recently" is the edge's decaying flow record (e-folding time `flowMemoryTicks`), so a link
 * that has stopped carrying r fades out rather than vanishing abruptly. Two neighbours who
 * both hold plenty of r never swap it, so their link stays invisible in r's view even
 * though it exists.
 *
 * View-only: reads the network, never mutates it.
 */
import {wrapDelta} from '../core/mathutil.js';
import {RESOURCE_PALETTE} from './forestview.js';

/** Recent flow below this is not drawn: residue decaying toward zero, not live trade. */
const MIN_VISIBLE_FLOW = 0.01;
/** Arrowheads only where at least this share of an edge's recent flow runs one way. */
const ARROW_NET_SHARE = 0.6;
const MAX_WIDTH = 9;
const TOPOLOGY_WIDTH = 1.6;

export const RESOURCE_NAMES = ['red', 'green', 'blue', 'gold', 'purple', 'teal', 'orange', 'lime'];

export function resourceName(r) {
    return RESOURCE_NAMES[r] ?? `resource ${r}`;
}

function resourceCss(r, alpha = 1) {
    const [red, green, blue] = RESOURCE_PALETTE[r % RESOURCE_PALETTE.length];
    return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`;
}

export class NetworkView {
    constructor() {
        /** @type {'off'|'topology'|number} */
        this.mode = 'off';
    }

    /** Step to the next mode: off -> links -> resource 0 -> ... -> resource R-1 -> off. */
    cycle(numResources) {
        if (this.mode === 'off') this.mode = 'topology';
        else if (this.mode === 'topology') this.mode = numResources > 0 ? 0 : 'off';
        else this.mode = this.mode + 1 < numResources ? this.mode + 1 : 'off';
    }

    /** Button caption for the current mode. */
    get label() {
        if (this.mode === 'off') return 'Network: OFF';
        if (this.mode === 'topology') return 'Network: links';
        return `Network: ${resourceName(this.mode)} flow`;
    }

    /** Drop a resource mode that no longer exists (e.g. after numResources was lowered). */
    validate(numResources) {
        if (typeof this.mode === 'number' && this.mode >= numResources) this.mode = 'off';
    }

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {{x:number, y:number}} origin  the forest view's top-left corner
     * @param {import('../core/simulation.js').Simulation} sim
     */
    draw(ctx, origin, sim) {
        const network = sim.world.exchange?.network;
        if (this.mode === 'off' || !network) return;
        const {forestwidth: width, forestheight: height} = sim.params;

        ctx.save();
        ctx.beginPath();
        ctx.rect(origin.x, origin.y, width, height);
        ctx.clip();
        ctx.lineCap = 'round';

        if (this.mode === 'topology') this.drawTopology(ctx, origin, sim, network);
        else this.drawResourceFlow(ctx, origin, sim, network, this.mode);

        ctx.restore();
    }

    drawTopology(ctx, origin, sim, network) {
        ctx.beginPath();
        for (const edge of network.edges.values()) this.tracePath(ctx, origin, sim, edge.a, edge.b);
        // One path stroked twice: a pale halo, then a near-black core on top of it.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = TOPOLOGY_WIDTH + 2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(15, 15, 15, 0.95)';
        ctx.lineWidth = TOPOLOGY_WIDTH;
        ctx.stroke();
    }

    drawResourceFlow(ctx, origin, sim, network, r) {
        const tick = sim.tick;
        const memory = network.flowMemoryTicks;
        const visible = [];
        for (const edge of network.edges.values()) {
            const total = edge.recentTotal(r, tick, memory);
            if (total < MIN_VISIBLE_FLOW) continue;
            const fromA = edge.recentFrom(edge.a, r, tick, memory);
            visible.push({edge, total, net: 2 * fromA - total});   // > 0: net flow a -> b
        }
        // Thin first, so the heaviest flows are drawn on top.
        visible.sort((p, q) => p.total - q.total);

        for (const {edge, total, net} of visible) {
            const width = Math.min(MAX_WIDTH, 1 + 1.5 * Math.log1p(total));
            // Dark halo first so the line stays visible over terrain of its own colour.
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.lineWidth = width + 2;
            ctx.beginPath();
            this.tracePath(ctx, origin, sim, edge.a, edge.b);
            ctx.stroke();

            ctx.strokeStyle = resourceCss(r, 0.95);
            ctx.lineWidth = width;
            ctx.beginPath();
            this.tracePath(ctx, origin, sim, edge.a, edge.b);
            ctx.stroke();

            if (Math.abs(net) >= ARROW_NET_SHARE * total) {
                const [from, to] = net > 0 ? [edge.a, edge.b] : [edge.b, edge.a];
                this.drawArrowhead(ctx, origin, sim, from, to, width, resourceCss(r, 1));
            }
        }
    }

    /**
     * Add the segment a -> b to the current path. On a torus, a link that is shorter across
     * the seam is drawn as two stubs leaving opposite edges, not as a line across the map.
     */
    tracePath(ctx, origin, sim, a, b) {
        const {dx, dy} = this.delta(sim, a, b);
        ctx.moveTo(origin.x + a.x, origin.y + a.y);
        ctx.lineTo(origin.x + a.x + dx, origin.y + a.y + dy);
        if (sim.params.wrapped && (dx !== b.x - a.x || dy !== b.y - a.y)) {
            ctx.moveTo(origin.x + b.x, origin.y + b.y);
            ctx.lineTo(origin.x + b.x - dx, origin.y + b.y - dy);
        }
    }

    delta(sim, a, b) {
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (sim.params.wrapped) {
            dx = wrapDelta(dx, sim.params.forestwidth);
            dy = wrapDelta(dy, sim.params.forestheight);
        }
        return {dx, dy};
    }

    drawArrowhead(ctx, origin, sim, from, to, width, color) {
        const {dx, dy} = this.delta(sim, from, to);
        const length = Math.hypot(dx, dy);
        if (length < 1e-6) return;
        const ux = dx / length, uy = dy / length;
        const size = 4 + width;
        const tipX = origin.x + from.x + dx * 0.5 + ux * size / 2;
        const tipY = origin.y + from.y + dy * 0.5 + uy * size / 2;
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - ux * size - uy * size * 0.6, tipY - uy * size + ux * size * 0.6);
        ctx.lineTo(tipX - ux * size + uy * size * 0.6, tipY - uy * size - ux * size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
}
