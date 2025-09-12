class Graph {
    constructor(x, y, data, label, sublabels = [], horizantal_lines = []) {
//        this.game = game;
        this.x = x;
        this.y = y;
        this.data = data;
        this.label = label;
        this.sublabels = sublabels;

        this.xSize = 1160;
        this.ySize = 115;
        this.ctx = gameEngine.ctx;
        this.colors = ["#00BB00", "#BB0000", "#00BBBB", "#CCCCCC"];
        this.maxVal = 0;
        this.horizantal_lines = horizantal_lines;
        this.fill = false;
    }
    update() {
    }
    draw(ctx) {
        this.updateMax();
        // if (!document.getElementById("graphs").checked) return;
        if (this.data[0].length > 1) {
            for (var j = 0; j < this.data.length; j++) {
                var data = this.data[j];

                this.ctx.strokeStyle = this.colors[j];
                this.ctx.lineWidth = 2;

                this.ctx.beginPath();
                var xPos = this.x;
                var yPos = data.length > this.xSize ? this.y + this.ySize - Math.floor(data[data.length - this.xSize] / this.maxVal * this.ySize)
                    : this.y + this.ySize - Math.floor(data[0] / this.maxVal * this.ySize);
                this.ctx.moveTo(xPos, yPos);
                var length = data.length > this.xSize ?
                    this.xSize : data.length;
                for (var i = 1; i < length; i++) {
                    var index = data.length > this.xSize ?
                        data.length - this.xSize - 1 + i : i;
                    xPos++;
                    yPos = this.y + this.ySize - Math.floor(data[index] / this.maxVal * this.ySize);
                    if (yPos <= 0) {
                        yPos = 0;
                    }

                    this.ctx.lineTo(xPos, yPos);
                }
                this.ctx.stroke();
                this.ctx.closePath();

                this.ctx.strokeStyle = "#000000";
                this.ctx.fillStyle = "#000000";
                this.ctx.textAlign = "right";
                this.ctx.fillText(data[data.length - 1], this.x + this.xSize - 5, yPos + 10);
                if (this.sublabels.length > 0) {
                    this.ctx.strokeStyle = this.colors[j];
                    this.ctx.fillStyle = this.colors[j];
                    this.ctx.fillText(this.sublabels[j], this.x + this.xSize - 5, yPos + 20);
                }
            }
        }
        var firstTick = 0;
        firstTick = this.data[0].length > this.xSize ? this.data[0].length - this.xSize : 0;
        this.ctx.fillStyle = "#000000";
        this.ctx.textAlign = "left";
        this.ctx.fillText(firstTick * PARAMS.reportingPeriod, this.x + 5, this.y + this.ySize + 10);
        this.ctx.textAlign = "right";
        this.ctx.fillText((this.data[0].length - 1)* PARAMS.reportingPeriod, this.x + this.xSize - 5, this.y + this.ySize + 10);
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.label, this.x + this.xSize / 2, this.y + this.ySize + 12);
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);
        //
        // this.horizantal_lines.forEach(([label, hLine]) => {
        //     // Add a horizontal line at y = 30
        //     this.ctx.strokeStyle = "#FF0000"; // Choose a color for the line
        //     this.ctx.lineWidth = 1;
        //     this.ctx.setLineDash([5, 5]);
        //     const yCanvas = this.y + this.ySize - Math.floor(hLine / this.maxVal * this.ySize);
        //     this.ctx.beginPath();
        //     this.ctx.moveTo(this.x, yCanvas);
        //     this.ctx.lineTo(this.x + this.xSize, yCanvas);
        //     this.ctx.stroke();
        //     this.ctx.closePath();
        //     this.ctx.setLineDash([]);
        //
        //     // Add a label to the dashed line
        //     this.ctx.fillStyle = "#FF0000"; // Match the color of the line
        //     this.ctx.textAlign = "left"; // Position the label
        //     this.ctx.font = "12px Arial"; // Set font size and style
        //     this.ctx.fillText(label, this.x + 5, yCanvas - 5); // Adjust position slightly above the line
        // });

        this.horizantal_lines.forEach(([label, hLine]) => {
            this.ctx.strokeStyle = "#FF0000"; // Choose a color for the line
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            let yCanvas = this.y + this.ySize - Math.floor(hLine / this.maxVal * this.ySize);

            // Ensure the horizontal line does not go above the graph
            if (yCanvas < this.y) {
                yCanvas = this.y;
            }

            this.ctx.beginPath();
            this.ctx.moveTo(this.x, yCanvas);
            this.ctx.lineTo(this.x + this.xSize, yCanvas);
            this.ctx.stroke();
            this.ctx.closePath();
            this.ctx.setLineDash([]);

            // Add a label to the dashed line
            this.ctx.fillStyle = "#FF0000"; // Match the color of the line
            this.ctx.textAlign = "left"; // Position the label
            this.ctx.font = "12px Arial"; // Set font size and style
            this.ctx.fillText(label, this.x + 5, Math.max(yCanvas - 5, this.y + 5)); // Adjust label position above the line, within bounds
        });
    }
    updateMax() {
        this.maxVal = Math.max(...[].concat(...this.data));
    }
}



