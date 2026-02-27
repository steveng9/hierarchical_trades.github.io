
class TradeFlowView {
    constructor(x, varViewer, selectionView) {
        this.x = x;
        this.varViewer = varViewer;
        this.selectionView = selectionView;
        this.rowHeight = 110;
        this.headerHeight = 24;
        this.panelWidth = PARAMS.canvaswidth - PARAMS.margin;

        // High-water mark: bands persist once a level has appeared
        this.peakMaxLevel = 1;

        // Per-trade smoothed invocation rate (invocations per draw frame)
        this.lastInvocations = new Map();  // trade.id → last observed total invocations
        this.smoothedRate    = new Map();  // trade.id → smoothed delta per frame
    }

    // Y position computed fresh each draw so we always sit below both columns
    get y() {
        const leftBottom  = this.varViewer.y + this.varViewer.ySize;
        const rightBottom = this.selectionView.y + this.selectionView.currentPanelHeight;
        return Math.max(leftBottom, rightBottom) + PARAMS.margin;
    }

    get activeTrades() {
        return gameEngine.automata.trademanager.trades.filter(t => !t.deprecated);
    }

    // When a hierarchy exists, hide L1 trades that have no active children — they crowd
    // the bottom band. Fall back to all active trades when there is no hierarchy yet.
    get displayedTrades() {
        const all = this.activeTrades;
        const hasHierarchy = all.some(t => t.level > 1);
        if (!hasHierarchy) return all;
        return all.filter(t => t.level > 1 || t.childTrades.some(c => !c.deprecated));
    }

    // Sticky: never shrinks — bands added as new levels appear, kept even if empty
    get maxLevel() { return this.peakMaxLevel; }

    get panelHeight() {
        return this.headerHeight + this.peakMaxLevel * this.rowHeight + 14;
    }

    // Y center of the horizontal band for the given level (level 1 = bottom band)
    bandCenterY(level) {
        const bandIndex = this.peakMaxLevel - level;
        return this.y + this.headerHeight + bandIndex * this.rowHeight + this.rowHeight / 2;
    }

    // Returns Map<tradeId, {x, y, maxR}> for each displayed trade
    computeLayout() {
        const trades = this.displayedTrades;
        const byLevel = {};
        for (const t of trades) {
            if (!byLevel[t.level]) byLevel[t.level] = [];
            byLevel[t.level].push(t);
        }

        const layout = new Map();
        const innerW = this.panelWidth - 40;

        for (const [levelStr, levelTrades] of Object.entries(byLevel)) {
            const level = parseInt(levelStr);
            const n = levelTrades.length;
            const spacing = n > 1 ? innerW / (n - 1) : 0;
            // Natural caps only: half-spacing so nodes don't touch neighbours, or half
            // the band height for a lone node. No arbitrary hard ceiling.
            const maxR = n > 1 ? spacing / 2 : this.rowHeight / 2 - 5;
            const centerY = this.bandCenterY(level);

            levelTrades.forEach((trade, i) => {
                const nodeX = n === 1
                    ? this.x + 20 + innerW / 2
                    : this.x + 20 + i * spacing;
                layout.set(trade.id, { x: nodeX, y: centerY, maxR });
            });
        }

        return layout;
    }

    // Area ∝ smoothed invocation rate  →  radius = √(rate × k), minimum 4 for visibility.
    // This gives the perceptually correct "diminishing returns" growth: doubling the
    // invocation rate doubles the circle area but only increases radius by √2.
    nodeRadius(trade, maxR) {
        const rate = this.smoothedRate.get(trade.id) || 0;
        return Math.min(maxR, Math.max(4, Math.sqrt(rate * 2)));
    }

    resColor(r) {
        const colors = ['#cc3333', '#33aa44', '#3355cc', '#cc9922', '#993399'];
        return colors[r] !== undefined ? colors[r] : '#888888';
    }

    update() {}

    draw(ctx) {
        const activeTrades = this.activeTrades;

        // Update high-water mark for level bands
        if (activeTrades.length > 0) {
            const currentMax = Math.max(...activeTrades.map(t => t.level));
            if (currentMax > this.peakMaxLevel) this.peakMaxLevel = currentMax;
        }

        // Update smoothed invocation rates only while running — skip when paused so
        // circles hold their last size rather than decaying toward zero each draw frame.
        const activeIds = new Set(activeTrades.map(t => t.id));
        if (isRunning) {
            const alpha = 0.08; // smoothing factor — lower = smoother but slower to react
            for (const trade of activeTrades) {
                const total = trade.invocations.A + trade.invocations.B;
                const last  = this.lastInvocations.has(trade.id) ? this.lastInvocations.get(trade.id) : total;
                const delta = Math.max(0, total - last);
                const prev  = this.smoothedRate.get(trade.id) || 0;
                this.smoothedRate.set(trade.id, alpha * delta + (1 - alpha) * prev);
                this.lastInvocations.set(trade.id, total);
            }
            // Evict stale entries for deprecated trades
            for (const id of this.smoothedRate.keys()) {
                if (!activeIds.has(id)) {
                    this.smoothedRate.delete(id);
                    this.lastInvocations.delete(id);
                }
            }
        }

        const trades  = this.displayedTrades;
        const layout  = this.computeLayout();
        const maxL    = this.peakMaxLevel;
        const panelY  = this.y;   // stable for this draw call
        const panelH  = this.panelHeight;

        ctx.save();

        // Panel background and border
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(this.x, panelY, this.panelWidth, panelH);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(this.x, panelY, this.panelWidth, panelH);

        // Header label
        ctx.fillStyle = '#222';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Hierarchy Flow View', this.x + 8, panelY + 17);

        // Legend: supply dot + size key
        ctx.font = '11px monospace';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'right';
        ctx.fillText('size = recent invocations/frame', this.x + this.panelWidth - 8, panelY + 17);

        // Draw a small example supply dot (split two resource colors) before the label
        const legendDotX = this.x + this.panelWidth - 225;
        const legendDotY = panelY + 12;
        ctx.save();
        ctx.beginPath();
        ctx.arc(legendDotX, legendDotY, 4, Math.PI / 2, 3 * Math.PI / 2, false);
        ctx.closePath(); ctx.fillStyle = this.resColor(0); ctx.fill();
        ctx.beginPath();
        ctx.arc(legendDotX, legendDotY, 4, -Math.PI / 2, Math.PI / 2, false);
        ctx.closePath(); ctx.fillStyle = this.resColor(1); ctx.fill();
        ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(legendDotX, legendDotY, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#555';
        ctx.textAlign = 'left';
        ctx.fillText('= resource mix in supply buffer', legendDotX + 7, panelY + 17);

        if (trades.length === 0) {
            ctx.fillStyle = '#888';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('No active trades', this.x + this.panelWidth / 2,
                panelY + this.headerHeight + this.rowHeight / 2 + 5);
            ctx.restore();
            return;
        }

        // Level bands (L1 at bottom, LN at top)
        for (let lvl = 1; lvl <= maxL; lvl++) {
            const bandIndex = maxL - lvl;
            const bandY = panelY + this.headerHeight + bandIndex * this.rowHeight;
            ctx.fillStyle = lvl % 2 === 0 ? '#f0f0f8' : '#f8f8f0';
            ctx.fillRect(this.x + 1, bandY, this.panelWidth - 2, this.rowHeight);
            ctx.fillStyle = '#888';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`L${lvl}`, this.x + 6, bandY + this.rowHeight / 2 + 4);
        }

        // Dividers between bands
        ctx.setLineDash([]);
        for (let lvl = 1; lvl < maxL; lvl++) {
            const bandIndex = maxL - lvl;
            const divY = panelY + this.headerHeight + bandIndex * this.rowHeight;
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x + 1, divY);
            ctx.lineTo(this.x + this.panelWidth - 1, divY);
            ctx.stroke();
        }

        // Animated dash offset: dashes appear to flow from parent node toward child node
        const animOffset = (Date.now() / 60) % 20;

        // Edges (parent → child)
        for (const trade of trades) {
            if (!trade.parentTrade) continue;
            const childPos  = layout.get(trade.id);
            const parentPos = layout.get(trade.parentTrade.id);
            if (!childPos || !parentPos) continue;

            const resource  = trade.resourcesIn[trade.parentSide];
            const color     = this.resColor(resource);
            const volume    = trade.volumeMoved[trade.parentSide] || 0;
            const lineWidth = Math.max(1.5, 1.5 + Math.log1p(volume / 50) * 2.0);

            // Shadow for legibility
            ctx.save();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = lineWidth + 2.5;
            ctx.setLineDash([10, 7]);
            ctx.lineDashOffset = -animOffset;
            ctx.beginPath();
            ctx.moveTo(parentPos.x, parentPos.y);
            ctx.lineTo(childPos.x, childPos.y);
            ctx.stroke();
            ctx.restore();

            // Colored dashed edge
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.setLineDash([10, 7]);
            ctx.lineDashOffset = -animOffset;
            ctx.beginPath();
            ctx.moveTo(parentPos.x, parentPos.y);
            ctx.lineTo(childPos.x, childPos.y);
            ctx.stroke();
            ctx.restore();
        }

        // Nodes (drawn on top of edges)
        for (const trade of trades) {
            const pos = layout.get(trade.id);
            if (!pos) continue;
            this.drawNode(ctx, trade, pos.x, pos.y, pos.maxR);
        }

        ctx.restore();
    }

    drawNode(ctx, trade, x, y, maxR) {
        const r      = this.nodeRadius(trade, maxR);
        const colorA = this.resColor(trade.resourcesIn.A);
        const colorB = this.resColor(trade.resourcesIn.B);

        // Left half: A resource color
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, Math.PI / 2, 3 * Math.PI / 2, false);
        ctx.closePath();
        ctx.fillStyle = colorA;
        ctx.fill();
        ctx.restore();

        // Right half: B resource color
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
        ctx.closePath();
        ctx.fillStyle = colorB;
        ctx.fill();
        ctx.restore();

        // Border: gray for L1, blue for L2+
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = trade.level === 1 ? '#555' : '#0055AA';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.restore();

        // Supply dot: mini pie chart colored by resource composition
        const supply = trade.supply.slice(0, PARAMS.numResources);
        const totalSupply = supply.reduce((s, v) => s + v, 0);
        if (totalSupply > 0.01) {
            const dotR = Math.min(r * 0.6, 2 + Math.sqrt(totalSupply));
            let startAngle = -Math.PI / 2;
            for (let res = 0; res < PARAMS.numResources; res++) {
                if (supply[res] <= 0) continue;
                const endAngle = startAngle + (supply[res] / totalSupply) * Math.PI * 2;
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.arc(x, y, dotR, startAngle, endAngle);
                ctx.closePath();
                ctx.fillStyle = this.resColor(res);
                ctx.fill();
                ctx.restore();
                startAngle = endAngle;
            }
            // Black border around the whole supply dot
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, dotR, 0, Math.PI * 2);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.8;
            ctx.setLineDash([]);
            ctx.stroke();
            ctx.restore();
        }

        // Resource pair label below node (only when node is large enough)
        if (r >= 6) {
            const resNames = ['R', 'G', 'B', 'Y', 'P'];
            const label = (resNames[trade.resourcesIn.A] || trade.resourcesIn.A) +
                          (resNames[trade.resourcesIn.B] || trade.resourcesIn.B);
            ctx.save();
            ctx.fillStyle = '#333';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(label, x, y + r + 11);
            ctx.restore();
        }
    }
}
