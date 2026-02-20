class VariableViewer {
    constructor(x, y, label, variableGetter) {
        this.x = x;
        this.y = y;
        this.label = label;
        this.variableGetter = variableGetter;
        this.xSize = PARAMS.leftpanelWidth;
        this.ySize = 140;
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

        ctx.restore();
    }
}
