/**
 * Forest rendering: cell colouring and every trade overlay.
 *
 * Split out of the old `Forest`, which mixed grid state with ~250 lines of canvas drawing.
 * The kernel's `Forest` is now pure state; this reads it and never mutates it.
 *
 * View-only state — which trade is selected, which level is being displayed — lives here
 * rather than on the model, so a headless run carries none of it.
 */
import {PARAMS, gameEngine} from '../browser/context.js';
import {distance} from '../core/mathutil.js';

export class ForestView {
    /** @param {import('../core/forest.js').Forest} forest */
    constructor(forest) {
        this.forest = forest;
        this.x = PARAMS.margin;
        this.y = PARAMS.margin;
        this.selectedTrade = null;
        this.tradeDisplayLevel = 0;   // 0 = off, N = highlight all level-N trades
    }

    get cols() { return this.forest.cols; }
    get rows() { return this.forest.rows; }
    get grid() { return this.forest.grid; }

    getConcentration(x, y, r) { return this.forest.getConcentration(x, y, r); }

    draw(ctx) {
        this.renderCells(ctx);

        if (this.tradeDisplayLevel > 0) {
            this.drawLevelOverlay(ctx);
        } else if (this.selectedTrade) {
            this.drawTradeOverlay(ctx, this.selectedTrade);
        }
    }

    selectTrade(trade) {
        this.selectedTrade = trade;
        this.tradeDisplayLevel = 0;
        const btn = document.getElementById('levelDisplayBtn');
        if (btn) btn.textContent = 'Level Display: OFF';
    }

    // Draw all trades at tradeDisplayLevel using existing line-drawing helpers
    drawLevelOverlay(ctx) {
        const level = this.tradeDisplayLevel;
        const CONNECTION_COLORS = [
            "rgba(0, 0, 0, 0.7)",
            "rgba(30, 100, 255, 0.7)",
            "rgba(150, 0, 200, 0.7)",
            "rgba(0, 180, 0, 0.7)",
        ];
        const color = CONNECTION_COLORS[Math.min(level - 1, CONNECTION_COLORS.length - 1)];

        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.y, PARAMS.forestwidth, PARAMS.forestheight);
        ctx.clip();

        for (let trade of gameEngine.automata.trademanager.trades) {
            if (trade.level !== level || trade.deprecated) continue;
            if (level === 1) {
                this.drawTradePairs(ctx, trade, "rgba(0, 0, 0, 0.7)");
            } else {
                const higherAgents = this.getTradeAgents(trade);
                if (higherAgents.size === 0) continue;
                const lowerAgents = this.getTradeAgents(trade.parentTrade);
                this.drawConnectionLines(ctx, higherAgents, lowerAgents, color);
            }
        }

        ctx.restore();
    }

    drawTradeOverlay(ctx, trade) {
        const CONNECTION_COLORS = [
            "rgba(0, 0, 0, 0.7)",
            "rgba(30, 100, 255, 0.7)",
            "rgba(150, 0, 200, 0.7)",
            "rgba(0, 180, 0, 0.7)",
        ];
        const ORANGE = "rgba(255, 140, 0, 0.7)";
        const BLACK = CONNECTION_COLORS[0];

        ctx.save();

        // Clip all overlay drawing to the forest bounds
        ctx.beginPath();
        ctx.rect(this.x, this.y, PARAMS.forestwidth, PARAMS.forestheight);
        ctx.clip();

        // Build ancestor chain: [selected, parent, grandparent, ..., L1]
        const chain = [];
        let current = trade;
        while (current) {
            chain.push(current);
            if (!current.isHierarchical) break;
            current = current.parentTrade;
        }

        // Draw reach shading beneath everything else
        this.drawTradeReach(ctx, chain);

        if (chain.length === 1) {
            // L1 selected: draw partner pairs in black
            this.drawTradePairs(ctx, chain[0], BLACK);
        } else {
            // Draw L1 trade_pairs in orange (bottom layer)
            this.drawTradePairs(ctx, chain[chain.length - 1], ORANGE);

            // Draw connections from higher to lower, bottom-up so selected draws on top
            for (let i = chain.length - 2; i >= 0; i--) {
                const higherAgents = this.getTradeAgents(chain[i]);
                const lowerAgents = this.getTradeAgents(chain[i + 1]);
                const color = CONNECTION_COLORS[i] ?? CONNECTION_COLORS[CONNECTION_COLORS.length - 1];
                this.drawConnectionLines(ctx, higherAgents, lowerAgents, color);
            }
        }

        // Draw inventor markers for all trades in chain (top layer)
        for (let t of chain) {
            if (t.inventor && !t.inventor.removeFromWorld) {
                this.drawInventorMarker(ctx, t.inventor);
            }
        }

        ctx.restore();
    }

    // Returns Map<Human, alpha> of live agents participating at a given trade level.
    // Stale entries (alpha <= 0) are pruned from the trade's tracking map.
    getTradeAgents(trade) {
        const FADE_TICKS = 1000;
        const currentTick = gameEngine.automata.generation;
        const agents = new Map();

        if (!trade.isHierarchical) {
            // L1: collect unique live humans from trade_partners; take max alpha per human
            const toDelete = [];
            for (let [key, lastTick] of trade.trade_partners) {
                const alpha = Math.max(0, 1 - (currentTick - lastTick) / FADE_TICKS);
                if (alpha <= 0) { toDelete.push(key); continue; }
                const [idA, idB] = key.split("-").map(Number);
                const h1 = gameEngine.automata.humanById.get(idA);
                const h2 = gameEngine.automata.humanById.get(idB);
                if (h1 && !h1.removeFromWorld) agents.set(h1, Math.max(agents.get(h1) || 0, alpha));
                if (h2 && !h2.removeFromWorld) agents.set(h2, Math.max(agents.get(h2) || 0, alpha));
            }
            for (let key of toDelete) trade.trade_partners.delete(key);
        } else {
            // L2+: agents are those who have specifically invoked this trade
            const toDelete = [];
            for (let [invoker, lastTick] of trade.invokers) {
                if (invoker.removeFromWorld) { toDelete.push(invoker); continue; }
                const alpha = Math.max(0, 1 - (currentTick - lastTick) / FADE_TICKS);
                if (alpha <= 0) { toDelete.push(invoker); continue; }
                agents.set(invoker, alpha);
            }
            for (let invoker of toDelete) trade.invokers.delete(invoker);
        }

        return agents;
    }

    // Draw L1 partner-pair lines, fading from fresh (alpha=1) to invisible over FADE_TICKS
    drawTradePairs(ctx, trade, fillColor) {
        const isBlack = fillColor === "rgba(0, 0, 0, 0.7)";
        const FADE_TICKS = 1000;
        const currentTick = gameEngine.automata.generation;
        const toDelete = [];

        for (let [key, lastTick] of trade.trade_partners) {
            const age = currentTick - lastTick;
            const alpha = Math.max(0, 1 - age / FADE_TICKS);

            if (alpha <= 0) {
                toDelete.push(key);
                continue;
            }

            const [idA, idB] = key.split("-").map(Number);
            const h1 = gameEngine.automata.humanById.get(idA);
            const h2 = gameEngine.automata.humanById.get(idB);
            if (!h1 || !h2) continue;

            ctx.globalAlpha = alpha;

            if (!isBlack) {
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x + h1.x, this.y + h1.y);
                ctx.lineTo(this.x + h2.x, this.y + h2.y);
                ctx.stroke();
            }

            ctx.strokeStyle = fillColor;
            ctx.lineWidth = isBlack ? 2 : 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x + h1.x, this.y + h1.y);
            ctx.lineTo(this.x + h2.x, this.y + h2.y);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        for (let key of toDelete) trade.trade_partners.delete(key);
    }

    // Draw lines from each agent in agentsA to the centroid of agentsB.
    // Both are Map<Human, alpha>; alpha controls per-line opacity for agentsA.
    drawConnectionLines(ctx, agentsA, agentsB, fillColor) {
        if (agentsB.size === 0) return;
        const isBlack = fillColor === "rgba(0, 0, 0, 0.7)";

        // Compute centroid of agentsB (position only, alpha not needed)
        let cx = 0, cy = 0;
        for (let b of agentsB.keys()) { cx += b.x; cy += b.y; }
        cx = this.x + cx / agentsB.size;
        cy = this.y + cy / agentsB.size;

        for (let [a, alpha] of agentsA) {
            ctx.globalAlpha = alpha;

            if (!isBlack) {
                ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x + a.x, this.y + a.y);
                ctx.lineTo(cx, cy);
                ctx.stroke();
            }

            ctx.strokeStyle = fillColor;
            ctx.lineWidth = isBlack ? 2 : 1.5;
            ctx.beginPath();
            ctx.moveTo(this.x + a.x, this.y + a.y);
            ctx.lineTo(cx, cy);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // Shade the geographic reach of the selected trade.
    // Visibility is permanent: a region unlocked by a (now-dead) inventor or manager stays unlocked.
    drawTradeReach(ctx, chain) {
        const selected = chain[0];
        if (!selected.inventor) return;

        // Draw full reach union (inventor + all ever-added managers) in light gold.
        // No removeFromWorld filter — dead inventors/managers still define permanent visibility.
        const offscreen = document.createElement('canvas');
        offscreen.width = ctx.canvas.width;
        offscreen.height = ctx.canvas.height;
        const octx = offscreen.getContext('2d');

        octx.fillStyle = 'rgba(255, 220, 80, 1)';
        octx.beginPath();
        octx.arc(this.x + selected.inventor.x, this.y + selected.inventor.y, selected.inventor.socialReach, 0, 2 * Math.PI);
        octx.fill();
        for (let manager of selected.managers) {
            octx.beginPath();
            octx.arc(this.x + manager.x, this.y + manager.y, manager.socialReach, 0, 2 * Math.PI);
            octx.fill();
        }

        ctx.globalAlpha = 0.25;
        ctx.drawImage(offscreen, 0, 0);
        ctx.globalAlpha = 1.0;

        // Dashed ring on the inventor's original circle — anything outside this ring
        // is manager-extended visibility
        ctx.strokeStyle = 'rgba(255, 120, 0, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(this.x + selected.inventor.x, this.y + selected.inventor.y, selected.inventor.socialReach, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw inventor as a diamond marker
    drawInventorMarker(ctx, human) {
        this.drawMarker(ctx, human, "rgba(0, 180, 0, 0.9)", 11);

        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.font = "10px monospace";
        ctx.textBaseline = "bottom";
        ctx.fillText("inv", this.x + human.x + 10, this.y + human.y - 4);
    }

    // Draw a diamond-shaped marker at a human's position
    drawMarker(ctx, human, color, size) {
        const cx = this.x + human.x;
        const cy = this.y + human.y;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy);
        ctx.lineTo(cx, cy + size);
        ctx.lineTo(cx - size, cy);
        ctx.closePath();
        ctx.fill();
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
