class TradeDataView {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.lineHeight = 18;
        this.hierLineHeight = 16;
        this.headerHeight = 26;
        this.maxRows = 15;
        this.maxHierRows = 8;
        this.panelWidth = PARAMS.rightpanelwidth;
        // main section + detail line + hierarchical sub-table (title + col header + sep + rows)
        this.hierSectionHeight = 20 + 14 + 6 + this.maxHierRows * this.hierLineHeight + 4;
        this.panelHeight = this.headerHeight + 20 + this.maxRows * this.lineHeight + 30 + this.hierSectionHeight;
        this.resourceNames = {0: "R", 1: "G", 2: "B"};

        this.selectedTrade = null;
        this.sortedTrades = [];
        this.sortedHierTrades = [];
    }

    resName(r) {
        return this.resourceNames[r] || `${r}`;
    }

    handleClick(mouseX, mouseY) {
        if (mouseX < this.x || mouseX > this.x + this.panelWidth ||
            mouseY < this.y || mouseY > this.y + this.panelHeight) return;

        // Main table: colHeaderY + 14 (sep) + 6 (gap)
        const dataStartY = this.y + this.headerHeight + 14 + 6;
        const mainTableEndY = dataStartY + this.maxRows * this.lineHeight;
        const row = Math.floor((mouseY - dataStartY) / this.lineHeight);

        if (mouseY < mainTableEndY && row >= 0 && row < this.maxRows && row < this.sortedTrades.length) {
            this.selectedTrade = this.sortedTrades[row];
            gameEngine.automata.forest.selectTrade(this.selectedTrade);
            return;
        }

        // Hierarchical sub-table: matches draw() offsets: +4 (detailLine) +22 (hierSection gap) +14 (colHeader) +12 (sep) +4 (gap)
        const hierDataStartY = mainTableEndY + 4 + 22 + 14 + 12 + 4;
        const hierRow = Math.floor((mouseY - hierDataStartY) / this.hierLineHeight);
        if (hierRow >= 0 && hierRow < this.maxHierRows && hierRow < this.sortedHierTrades.length) {
            this.selectedTrade = this.sortedHierTrades[hierRow];
            gameEngine.automata.forest.selectTrade(this.selectedTrade);
        }
    }

    update() {}

    draw(ctx) {
        const allTrades = [...gameEngine.automata.trademanager.trades];
        this.sortedTrades = allTrades
            .filter(t => t.level === 1)
            .sort((a, b) => (b.invocations.A + b.invocations.B) - (a.invocations.A + a.invocations.B));
        this.sortedHierTrades = allTrades
            .filter(t => t.level > 1)
            .sort((a, b) => b.level - a.level || (b.invocations.A + b.invocations.B) - (a.invocations.A + a.invocations.B));

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

        // Column definitions (upper table = L1 only, no Lvl column needed)
        const cols = [
            {label: "T#",      x: px + 8},
            {label: "Inv",     x: px + 55},
            {label: "Exchange",x: px + 100},
            // {label: "Parent",  x: px + 210},
            {label: "Surplus", x: px + 210},
            {label: "Invk",    x: px + 280},
            {label: "Volume",  x: px + 340},
            {label: "Supply",  x: px + 400},
            {label: "Mgrs",    x: px + 640},
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

        // If a hierarchical trade is selected, highlight its nearest L1 ancestor in the upper table
        let selectedL1Parent = this.selectedTrade;
        while (selectedL1Parent && selectedL1Parent.level > 1) {
            selectedL1Parent = selectedL1Parent.parentTrade;
        }
        if (selectedL1Parent === this.selectedTrade) selectedL1Parent = null;

        // Build display slice — pin selected L1 trade into view if it's outside the top rows
        let displayTrades = this.sortedTrades.slice(0, this.maxRows);
        if (this.selectedTrade?.level === 1 &&
            this.sortedTrades.includes(this.selectedTrade) &&
            !displayTrades.includes(this.selectedTrade)) {
            displayTrades = [...displayTrades.slice(0, this.maxRows - 1), this.selectedTrade];
        }

        // Data rows
        const dataStartY = sepY + 6;
        let row = 0;

        for (let trade of displayTrades) {
            const rowY = dataStartY + row * this.lineHeight;

            if (this.selectedTrade === trade) {
                ctx.fillStyle = "rgba(200, 200, 0, 0.25)";
                ctx.fillRect(px + 3, rowY - 2, pw - 6, this.lineHeight);
            } else if (selectedL1Parent === trade) {
                ctx.fillStyle = "rgba(255, 140, 0, 0.2)";
                ctx.fillRect(px + 3, rowY - 2, pw - 6, this.lineHeight);
            }

            ctx.fillStyle = "#000";
            ctx.font = "11px monospace";

            ctx.fillText(`${trade.id}`,                                                   cols[0].x, rowY);
            ctx.fillText(`H${trade.inventor.id}`,                                         cols[1].x, rowY);
            ctx.fillText(`${this.resName(trade.resourcesIn.A)} <-> ${this.resName(trade.resourcesIn.B)}`, cols[2].x, rowY);

            const totalSurplus = trade.surpluses.A + trade.surpluses.B;
            ctx.fillText(`${totalSurplus.toFixed(2)}`,                                    cols[3].x, rowY);

            const totalInvk = trade.invocations.A + trade.invocations.B;
            ctx.fillText(`${totalInvk}`,                                                  cols[4].x, rowY);

            const totalVol = trade.volumeMoved.A + trade.volumeMoved.B;
            ctx.fillText(`${totalVol.toFixed(0)}`,                                        cols[5].x, rowY);

            const supplyStr = trade.supply
                .slice(0, PARAMS.numResources)
                .map((v, i) => `${this.resName(i)}:${v.toFixed(1)}`)
                .filter(s => !s.endsWith(":0.0"))
                .join(" ");
            ctx.fillText(supplyStr || "--",                                                cols[6].x, rowY);

            ctx.fillText(`${trade.managers.size}`,                                        cols[7].x, rowY);

            row++;
        }

        // Detail panel for selected trade (bottom strip)
        const detailY = dataStartY + this.maxRows * this.lineHeight + 4;
        if (this.selectedTrade) {
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

        // ── Hierarchical trades sub-table ──────────────────────────────────
        const hierSectionY = detailY + 22;

        ctx.fillStyle = "#0055AA";
        ctx.font = "bold 12px monospace";
        const hierCount = this.sortedHierTrades.length;
        ctx.fillText(`Hierarchical Trades (L2+): ${hierCount}`, px + 8, hierSectionY);

        // col headers
        const hierColHeaderY = hierSectionY + 14;
        // Lower table has its own column layout that includes Lvl
        const hierCols = [
            {label: "T#",      x: px + 8},
            {label: "Lvl",     x: px + 55},
            {label: "Inv",     x: px + 80},
            {label: "Exchange",x: px + 150},
            {label: "Parent",  x: px + 280},
            {label: "Surplus", x: px + 340},
            {label: "Invk",    x: px + 400},
            {label: "Volume",  x: px + 480},
            {label: "Supply",  x: px + 600},
            {label: "Mgrs",    x: px + 700},
        ];

        ctx.font = "11px monospace";
        ctx.fillStyle = "#555";
        for (let col of hierCols) {
            ctx.fillText(col.label, col.x, hierColHeaderY);
        }

        // separator
        const hierSepY = hierColHeaderY + 12;
        ctx.beginPath();
        ctx.moveTo(px + 5, hierSepY);
        ctx.lineTo(px + pw - 5, hierSepY);
        ctx.strokeStyle = "#99AACC";
        ctx.lineWidth = 1;
        ctx.stroke();

        const hierDataStartY = hierSepY + 4;

        if (hierCount === 0) {
            ctx.fillStyle = "#AAA";
            ctx.font = "11px monospace";
            ctx.fillText("none yet", px + 8, hierDataStartY);
        } else {
            // Pin selected hier trade into view if it's outside the top rows
            let displayHierTrades = this.sortedHierTrades.slice(0, this.maxHierRows);
            if (this.selectedTrade?.level > 1 &&
                this.sortedHierTrades.includes(this.selectedTrade) &&
                !displayHierTrades.includes(this.selectedTrade)) {
                displayHierTrades = [...displayHierTrades.slice(0, this.maxHierRows - 1), this.selectedTrade];
            }

            let hierRow = 0;
            for (let trade of displayHierTrades) {
                const rowY = hierDataStartY + hierRow * this.hierLineHeight;

                if (this.selectedTrade === trade) {
                    ctx.fillStyle = "rgba(200, 200, 0, 0.25)";
                    ctx.fillRect(px + 3, rowY - 2, pw - 6, this.hierLineHeight);
                }

                ctx.fillStyle = "#0055AA";
                ctx.font = "11px monospace";

                ctx.fillText(`${trade.id}`,            hierCols[0].x, rowY);
                ctx.fillText(`${trade.level}`,         hierCols[1].x, rowY);
                ctx.fillText(`H${trade.inventor.id}`,  hierCols[2].x, rowY);

                const agentSide = trade.agentSide();
                const agentRes = this.resName(trade.resourcesIn[agentSide]);
                const parentRes = this.resName(trade.resourcesIn[trade.parentSide]);
                ctx.fillText(`${agentRes}->[T${trade.parentTrade.id}:${parentRes}]`, hierCols[3].x, rowY);

                ctx.fillStyle = "#D48000";
                ctx.fillText(`T${trade.parentTrade.id}`, hierCols[4].x, rowY);
                ctx.fillStyle = "#0055AA";

                const totalSurplus = trade.surpluses.A + trade.surpluses.B;
                ctx.fillText(`${totalSurplus.toFixed(1)}`,  hierCols[5].x, rowY);

                const totalInvk = trade.invocations.A + trade.invocations.B;
                ctx.fillText(`${totalInvk}`,                hierCols[6].x, rowY);

                const totalVol = trade.volumeMoved.A + trade.volumeMoved.B;
                ctx.fillText(`${totalVol.toFixed(0)}`,      hierCols[7].x, rowY);

                const supplyStr = trade.supply
                    .slice(0, PARAMS.numResources)
                    .map((v, i) => `${this.resName(i)}:${v.toFixed(1)}`)
                    .filter(s => !s.endsWith(":0.0"))
                    .join(" ");
                ctx.fillText(supplyStr || "--",             hierCols[8].x, rowY);

                ctx.fillText(`${trade.managers.size}`,      hierCols[9].x, rowY);

                hierRow++;
            }
            if (hierCount > this.maxHierRows) {
                ctx.fillStyle = "#888";
                ctx.font = "10px monospace";
                ctx.fillText(`+${hierCount - this.maxHierRows} more`, px + 8, hierDataStartY + this.maxHierRows * this.hierLineHeight);
            }
        }

        ctx.restore();
    }
}
