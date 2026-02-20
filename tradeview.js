class TradeDataView {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.lineHeight = 18;
        this.headerHeight = 26;
        this.maxRows = 15;
        this.panelWidth = PARAMS.rightpanelwidth;
        this.panelHeight = this.headerHeight + 20 + this.maxRows * this.lineHeight + 30; // header + col headers + rows + detail
        this.resourceNames = {0: "R", 1: "G", 2: "B"};

        this.selectedTrade = null;
        this.sortedTrades = [];
    }

    resName(r) {
        return this.resourceNames[r] || `${r}`;
    }

    handleClick(mouseX, mouseY) {
        if (mouseX < this.x || mouseX > this.x + this.panelWidth ||
            mouseY < this.y || mouseY > this.y + this.panelHeight) return;

        // Must match draw(): colHeaderY + 14 (sep) + 6 (gap)
        const dataStartY = this.y + this.headerHeight + 14 + 6;
        const row = Math.floor((mouseY - dataStartY) / this.lineHeight);

        if (row >= 0 && row < this.maxRows && row < this.sortedTrades.length) {
            this.selectedTrade = this.sortedTrades[row];
            gameEngine.automata.forest.selectTrade(this.selectedTrade);
        }
    }

    update() {}

    draw(ctx) {
        this.sortedTrades = [...gameEngine.automata.trademanager.trades].sort(
            (a, b) => (b.invocations.A + b.invocations.B) - (a.invocations.A + a.invocations.B)
        );

        const px = this.x;  // panel x
        const py = this.y;  // panel y
        const pw = this.panelWidth;

        ctx.save();

        // Panel background
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pw, this.panelHeight);

        // Title
        ctx.fillStyle = "#000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("Trade Data View", px + 8, py + 6);

        // Column definitions: [label, xOffset, width]
        const cols = [
            {label: "T#",     x: px + 8},
            {label: "Lvl",    x: px + 38},
            {label: "Inv",    x: px + 64},
            {label: "Exchange",x: px + 96},
            {label: "Parent", x: px + 200},
            {label: "Surplus", x: px + 280},
            {label: "Invk",   x: px + 340},
            {label: "Volume",  x: px + 400},
            {label: "Supply",  x: px + 480},
            {label: "Mgrs",   x: px + 600},
        ];

        // Column headers
        ctx.font = "11px monospace";
        ctx.fillStyle = "#555";
        const colHeaderY = py + this.headerHeight;
        for (let col of cols) {
            ctx.fillText(col.label, col.x, colHeaderY);
        }

        // Separator
        const sepY = colHeaderY + 14;
        ctx.beginPath();
        ctx.moveTo(px + 5, sepY);
        ctx.lineTo(px + pw - 5, sepY);
        ctx.strokeStyle = "#999";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Determine parent trade of selected (for highlighting)
        const selectedParent = this.selectedTrade?.parentTrade || null;

        // Data rows
        const dataStartY = sepY + 6;
        let row = 0;

        for (let trade of this.sortedTrades) {
            if (row >= this.maxRows) break;
            const rowY = dataStartY + row * this.lineHeight;

            // Highlight: selected trade = yellow, parent of selected = orange
            if (this.selectedTrade === trade) {
                ctx.fillStyle = "rgba(200, 200, 0, 0.25)";
                ctx.fillRect(px + 3, rowY - 2, pw - 6, this.lineHeight);
            } else if (selectedParent === trade) {
                ctx.fillStyle = "rgba(255, 140, 0, 0.2)";
                ctx.fillRect(px + 3, rowY - 2, pw - 6, this.lineHeight);
            }

            // Text color by level
            const isHierarchical = trade.level > 1;
            ctx.fillStyle = isHierarchical ? "#0055AA" : "#000";
            ctx.font = "11px monospace";

            // T# (trade id)
            ctx.fillText(`${trade.id}`, cols[0].x, rowY);

            // Lvl
            ctx.fillText(`${trade.level}`, cols[1].x, rowY);

            // Inventor
            ctx.fillText(`H${trade.inventor.id}`, cols[2].x, rowY);

            // Exchange: show resource pair with direction
            if (isHierarchical) {
                const agentSide = trade.agentSide();
                const agentRes = this.resName(trade.resourcesIn[agentSide]);
                const parentRes = this.resName(trade.resourcesIn[trade.parentSide]);
                ctx.fillText(`${agentRes} -> [T${trade.parentTrade.id}:${parentRes}]`, cols[3].x, rowY);
            } else {
                ctx.fillText(`${this.resName(trade.resourcesIn.A)} <-> ${this.resName(trade.resourcesIn.B)}`, cols[3].x, rowY);
            }

            // Parent
            if (trade.parentTrade) {
                ctx.fillStyle = "#D4800090";
                ctx.fillText(`T${trade.parentTrade.id}`, cols[4].x, rowY);
                ctx.fillStyle = isHierarchical ? "#0055AA" : "#000";
            } else {
                ctx.fillStyle = "#AAA";
                ctx.fillText(`--`, cols[4].x, rowY);
                ctx.fillStyle = isHierarchical ? "#0055AA" : "#000";
            }

            // Surplus
            const totalSurplus = trade.surpluses.A + trade.surpluses.B;
            ctx.fillText(`${totalSurplus.toFixed(2)}`, cols[5].x, rowY);

            // Invocations (total both sides)
            const totalInvk = trade.invocations.A + trade.invocations.B;
            ctx.fillText(`${totalInvk}`, cols[6].x, rowY);

            // Volume (total)
            const totalVol = trade.volumeMoved.A + trade.volumeMoved.B;
            ctx.fillText(`${totalVol.toFixed(0)}`, cols[7].x, rowY);

            // Supply (what the trade has accumulated)
            const supplyStr = trade.supply
                .slice(0, PARAMS.numResources)
                .map((v, i) => `${this.resName(i)}:${v.toFixed(1)}`)
                .filter(s => !s.endsWith(":0.0"))
                .join(" ");
            ctx.fillText(supplyStr || "--", cols[8].x, rowY);

            // Managers count
            ctx.fillText(`${trade.managers.size}`, cols[9].x, rowY);

            row++;
        }

        // Detail panel for selected trade (bottom strip)
        if (this.selectedTrade) {
            const detailY = dataStartY + this.maxRows * this.lineHeight + 4;
            ctx.fillStyle = "#333";
            ctx.font = "11px monospace";
            const t = this.selectedTrade;
            let line1 = `T${t.id} (L${t.level}) | XinXout A:${t.XinXout.A.toFixed(2)} B:${t.XinXout.B.toFixed(2)}`;
            if (t.parentTrade) {
                line1 += ` | Parent: T${t.parentTrade.id} (L${t.parentTrade.level})`;
            }
            const activeChildren = t.childTrades.filter(c => !c.deprecated);
            if (activeChildren.length > 0) {
                const shown = activeChildren.slice(0, 5).map(c => `T${c.id}`).join(',');
                const suffix = activeChildren.length > 5 ? ` +${activeChildren.length - 5} more` : '';
                line1 += ` | ${activeChildren.length} children: ${shown}${suffix}`;
            }
            ctx.fillText(line1, px + 8, detailY);
        }

        ctx.restore();
    }
}
