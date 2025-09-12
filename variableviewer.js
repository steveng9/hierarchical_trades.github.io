class VariableViewer {
    constructor(x, y, label, variableGetter) {
        this.x = x;
        this.y = y;
        this.label = label;
        this.variableGetter = variableGetter;

        this.xSize = 570;
        this.ySize = 120;
        this.ctx = gameEngine.ctx;
        this.colors = ["#00BB00", "#BB0000", "#00BBBB", "#CCCCCC"];
        this.maxVal = 0;
    }
    update() {
    }
    draw(ctx) {
        // Check if the graph drawing is enabled
        // if (!document.getElementById("graphs").checked) return;

        // Set the style for the box
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;

        // Draw the box
        this.ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);

        // Set the style for the text
        this.ctx.fillStyle = "#000000";
        this.ctx.textAlign = "left";
        this.ctx.font = "14px Arial";

        // Calculate the spacing between each variable display
        const lineHeight = 20;
        let startX = this.x + 10;
        let startY = this.y + 20;

        let i = 0;
        const variables = this.variableGetter();
        // Iterate over the variables returned by the function
        for (let [key, value] of Object.entries(variables)) {
            const text = `${key}: ${value}`;

            // Draw the text inside the box
            this.ctx.fillText(text, startX, startY);

            // Update the y position for the next variable
            startY += lineHeight;

            // Break the loop if the box height is exceeded
            if (startY > this.y + this.ySize - 10) {
                startY = this.y + 20;
                startX += 260;
            }

        }

    }

}



