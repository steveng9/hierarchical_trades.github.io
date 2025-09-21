class TradeDataView {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.lineHeight = 20;
        this.headerHeight = 28;
        this.startY = 20;
        this.maxRows = 10;  // show top 20 trades
        this.panelWidth = PARAMS.rightpanelwidth;
        this.panelHeight = this.maxRows * this.lineHeight + 40;
        this.resourceDisplayNames = {0: "R", 1: "G", 2: "B"};
        this.trade_sort_frequency = 10;
        this.num_draws_since_sort = this.trade_sort_frequency;

        
        this.selectedTrade = null;
    }

    handleClick(mouseX, mouseY) {
        // Check if click is inside panel
        if (mouseX < this.x || mouseX > this.x + this.panelWidth ||
            mouseY < this.y || mouseY > this.y + this.panelHeight) return;

        const headerY = this.y + this.headerHeight;
        const startY = headerY + this.startY;
        const row = Math.floor((mouseY - startY) / this.lineHeight);

        if (row >= 0 && row < this.maxRows && row < this.sortedTrades.length) {
            this.selectedTrade = this.sortedTrades[row];
            gameEngine.automata.forest.selectTrade(this.selectedTrade);
        }
    }


    update() {
    }

    draw(ctx) {
        
        // this.num_draws_since_sort += 1;
        // if (this.num_draws_since_sort >= this.trade_sort_frequency) {
        //     this.num_draws_since_sort = 0;
        //     // Sort trades by invocation count (descending)
        //     this.sortedTrades = [...gameEngine.automata.trademanager.trades].sort(
        //         (a, b) => b.invocations.A - a.invocations.A
        //     );
        // }
        this.sortedTrades = [...gameEngine.automata.trademanager.trades].sort(
            (a, b) => b.invocations.A - a.invocations.A
        );
        
        ctx.save();

        // Panel outline
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.panelWidth, this.panelHeight);

        // Title
        ctx.fillStyle = "#000000";
        ctx.font = "bold 14px monospace";
        ctx.textBaseline = "top";
        ctx.fillText("Trade Data View", this.x + 8, this.y + 8);

        
        // Column positions
        const colX = {
            inventor: this.x + 10,
            Ain: this.x + 40,
            Bin: this.x + 85,
            surplusA: this.x + 130,
            invokeA: this.x + 220,
            invokeB: this.x + 290,
            volA: this.x + 350,
            volB: this.x + 410,
        };

        // Column headers
        ctx.font = "12px monospace";
        const headerY = this.y + this.headerHeight;
        ctx.fillText("HID", colX.inventor, headerY);
        ctx.fillText("A in", colX.Ain, headerY);
        ctx.fillText("B in", colX.Bin, headerY);
        ctx.fillText("Srpls A", colX.surplusA, headerY);
        ctx.fillText("Invk. A", colX.invokeA, headerY);
        ctx.fillText("Invk. B", colX.invokeB, headerY);
        ctx.fillText("Volume A", colX.volA, headerY);
        ctx.fillText("Volume B", colX.volB, headerY);

        // Separator line
        ctx.beginPath();
        ctx.moveTo(this.x + 8, headerY + 14);
        ctx.lineTo(this.x + this.panelWidth - 8, headerY + 14);
        ctx.stroke();

        // Rows
        // if (!this.sortedTrades) this.update(); // lazy init
        const startY = headerY + this.startY;
        let row = 0;

        for (let trade of this.sortedTrades) {
            if (row >= this.maxRows) break;
            const rowY = startY + row * this.lineHeight;
            
            // Highlight selected
            if (this.selectedTrade === trade) {
                ctx.fillStyle = "rgba(200,200,0,0.2)";
                ctx.fillRect(this.x + 5, rowY - 2, this.panelWidth - 10, this.lineHeight);
            }

            ctx.fillStyle = "#000000";
            ctx.fillText(trade.inventor.id, colX.inventor, rowY);
            ctx.fillText(this.resourceDisplayNames[trade.resourcesIn.A], colX.Ain, rowY);
            ctx.fillText(this.resourceDisplayNames[trade.resourcesIn.B], colX.Bin, rowY);
            ctx.fillText((trade.XinXout.B - trade.XinXout.A).toFixed(2), colX.surplusA, rowY);
            ctx.fillText(trade.invocations.A.toString(), colX.invokeA, rowY);
            ctx.fillText(trade.invocations.B.toString(), colX.invokeB, rowY);
            ctx.fillText(trade.volumeMoved.A.toFixed(1), colX.volA, rowY);
            ctx.fillText(trade.volumeMoved.B.toFixed(1), colX.volB, rowY);

            row++;
        }

        ctx.restore();
    }
}
