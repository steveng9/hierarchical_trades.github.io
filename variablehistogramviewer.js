class VariableHistogramViewer {
    constructor(x, y, label) {
//        this.game = game;
        this.x = x;
        this.y = y;
        this.label = label;

        this.xSize = 1160;
        this.ySize = 500;
        this.ctx = gameEngine.ctx;
        this.colors = ["#00BB00", "#BB0000", "#00BBBB", "#CCCCCC"];
        this.maxVal = 0;

    }
    update() {
    }

    draw(ctx) {
        let shadePondFullValues = document.getElementById("isPondFull").checked;
        let shadeSupplyFullValues = document.getElementById("isSupplyFull").checked;
        let shadeHungryValues = document.getElementById("isHungry").checked;

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
        const lineHeight = 55;
        let startX = this.x + 10;
        let startY = this.y + 20;
        const histogramHeight = 26; // Height of each mini-histogram
        const histogramWidth = 200; // Width of each mini-histogram

        // Loop through the variables and display their names and values
        const aveQValues = this.calculateAverageQValues();

        const orderedAveQValues = Object.keys(aveQValues).sort().reduce(
            (obj, key) => {
                obj[key] = aveQValues[key];
                return obj;
            },
            {}
        );

        // Group initial Q-values for each gene
        const qValuesByGene = this.groupQValuesByGene();


        for (let key in orderedAveQValues) {
            if (shadePondFullValues && key[6] == "1") {
                this.ctx.fillStyle = "rgba(200,133,57,0.30)";
                this.ctx.fillRect(startX, startY-20, 250, lineHeight);
            }

            if (shadeSupplyFullValues && key[7] == "1") {
                this.ctx.fillStyle = "rgba(56,202,107,0.30)";
                this.ctx.fillRect(startX, startY-20, 250, lineHeight);
            }

            if (shadeHungryValues && key[8] == "1") {
                this.ctx.fillStyle = "rgba(77,84,189,0.30)";
                this.ctx.fillRect(startX, startY-20, 250, lineHeight);
            }

            if (shadeHungryValues && key[8] == "2") {
                this.ctx.fillStyle = "rgba(204,30,102,0.30)";
                this.ctx.fillRect(startX, startY-20, 250, lineHeight);
            }

            const text = `${key}: ${orderedAveQValues[key].toFixed(3)}`;

            // Draw the histogram
            const values = qValuesByGene[key];
            this.drawHistogram(values, startX + 10, startY - 10, histogramWidth, histogramHeight);

            // Draw the text inside the box

            this.ctx.fillStyle = "#000000";
            this.ctx.fillText(text, startX+15, startY+32);

            // Update the y position for the next variable
            startY += lineHeight;

            // Break the loop if the box height is exceeded
            if (startY > this.y + this.ySize - 10) {
                startY = this.y + 20;
                startX += 260;
            }
        }

        this.ctx.textAlign = "center";
        this.ctx.fillText(this.label, this.x + this.xSize / 2, this.y + this.ySize + 12);
    }

    calculateAverageQValues() {
        let sums = {};
        let counts = {};

        gameEngine.automata.humans.forEach(human => {

            for (let [key, value] of human.learner.qValues.entries()) {

                // If the key is not yet in sums or counts, initialize them
                if (!sums.hasOwnProperty(key)) {
                    sums[key] = 0;
                    counts[key] = 0;
                }
                // Update the sum and count for the key
                sums[key] += value;
                counts[key] += 1;
            }
        });

        // Initialize a dictionary to store the averages
        let averages = {};

        // Calculate the average for each key
        for (let key in sums) {
            averages[key] = sums[key] / counts[key];
        }

        return averages;
    }


    groupQValuesByGene() {
        const qValuesByGene = {};

        gameEngine.automata.humans.forEach(human => {
            for (let [stateAction, value] of human.learner.qValues) {
            // human.learner.qValues.forEach((qGene, value) => {
                if (!qValuesByGene[stateAction]) {
                    qValuesByGene[stateAction] = [];
                }
                qValuesByGene[stateAction].push(value);
            }
        });

        return qValuesByGene;
    }

    drawHistogram(values, x, y, width, height) {
        // Calculate bins and frequencies
        const numBins = 50;
        // const minValue = Math.min(...values);
        // const maxValue = Math.max(...values);

        const minValue = -2;
        const maxValue = 2;
        const binWidth = (maxValue - minValue) / numBins;
        const bins = Array(numBins).fill(0);

        values.forEach(value => {
            const binIndex = Math.min(
                Math.floor((value - minValue) / binWidth),
                numBins - 1
            );
            bins[binIndex]++;
        });

        // Find the max frequency for scaling
        const maxFrequency = Math.max(...bins);

        // Draw the histogram bars
        bins.forEach((freq, i) => {
            const barHeight = (freq / maxFrequency) * height;
            const barWidth = width / numBins;
            const barX = x + i * barWidth;
            const barY = y + height - barHeight;

            this.ctx.fillStyle = "#007ACC";
            this.ctx.fillRect(barX, barY, barWidth - 2, barHeight);
        });

        // Draw axes
        this.ctx.strokeStyle = "#000000";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y + height); // X-axis
        this.ctx.lineTo(x + width, y + height);
        this.ctx.moveTo(x, y); // Y-axis
        this.ctx.lineTo(x, y + height);
        this.ctx.stroke();
    }

}

//
// class InitialQValueGeneViewer {
//     constructor(x, y, label) {
//         this.x = x;
//         this.y = y;
//         this.label = label;
//
//         this.xSize = 1160;
//         this.ySize = 460;
//         this.updateTick = 50;
//         this.ctx = gameEngine.ctx;
//         this.colors = ["#00BB00", "#BB0000", "#00BBBB", "#CCCCCC"];
//         let k = 0;
//         // this.miniHistograms = this.initHistograms();
//
//     }
//
//     update() {
//     }
//
//     initHistograms() {
//         let histograms = [];
//         let firstGeneValues = this.groupQValuesByGene();
//
//         const sortedGenes = Object.keys(firstGeneValues).sort();
//
//         // Calculate the spacing between each variable display
//         const lineHeight = 70; // Adjusted for histograms
//         const histogramHeight = 60; // Height of each mini-histogram
//         const histogramWidth = 200; // Width of each mini-histogram
//
//         let startX = this.x + 10;
//         let startY = this.y + 20;
//
//         for (let geneName of sortedGenes) {
//             const values = firstGeneValues[geneName]
//             histograms.push(new Histogram(startX, startY, [], geneName, histogramWidth, histogramHeight))
//
//             startY += lineHeight;
//             // Break the loop if the box height is exceeded
//             if (startY > this.y + this.ySize - 10) {
//                 startY = this.y + 20;
//                 startX += 260;
//             }
//         }
//     }
//
//     updateData() {
//
//     }
//
//     draw(ctx) {
//
//         let shadePondFullValues = document.getElementById("isPondFull").checked;
//         let shadeSupplyFullValues = document.getElementById("isSupplyFull").checked;
//         let shadeHungryValues = document.getElementById("isHungry").checked;
//
//         // Set the style for the box
//         this.ctx.strokeStyle = "#000000";
//         this.ctx.lineWidth = 1;
//
//         // Draw the box
//         this.ctx.strokeRect(this.x, this.y, this.xSize, this.ySize);
//
//
//         // Calculate the spacing between each variable display
//         const lineHeight = 50; // Adjusted for histograms
//         const histogramHeight = 26; // Height of each mini-histogram
//         const histogramWidth = 200; // Width of each mini-histogram
//         let startX = this.x + 10;
//         let startY = this.y + 20;
//
//         // Group initial Q-values for each gene
//         const qValuesByGene = this.groupQValuesByGene();
//
//         // Sort genes alphabetically
//         const sortedGenes = Object.keys(qValuesByGene).sort();
//
//         for (let geneName of sortedGenes) {
//             const values = qValuesByGene[geneName];
//             if (shadePondFullValues && geneName[6] == "1") {
//                 this.ctx.fillStyle = "rgba(200,133,57,0.30)";
//                 this.ctx.fillRect(startX, startY-15, 250, 50);
//             }
//
//             if (shadeSupplyFullValues && geneName[7] == "1") {
//                 this.ctx.fillStyle = "rgba(56,202,107,0.30)";
//                 this.ctx.fillRect(startX, startY-15, 250, 50);
//             }
//
//             if (shadeHungryValues && geneName[8] == "1") {
//                 this.ctx.fillStyle = "rgba(77,84,189,0.30)";
//                 this.ctx.fillRect(startX, startY-15, 250, 50);
//             }
//
//             if (shadeHungryValues && geneName[8] == "2") {
//                 this.ctx.fillStyle = "rgba(204,30,102,0.30)";
//                 this.ctx.fillRect(startX, startY-15, 250, 50);
//             }
//
//             // Set the style for the text
//             this.ctx.fillStyle = "#000000";
//             this.ctx.textAlign = "center";
//             this.ctx.font = "14px Arial";
//             // Draw the gene name
//             this.ctx.fillText(`${geneName}`, startX + histogramWidth/2, startY + histogramHeight + 3);
//
//             // Draw the histogram
//             this.drawHistogram(values, startX + 10, startY - 10, histogramWidth, histogramHeight);
//
//             // Update the y position for the next variable
//             startY += lineHeight;
//
//             // Break the loop if the box height is exceeded
//             if (startY > this.y + this.ySize - 10) {
//                 startY = this.y + 20;
//                 startX += 260;
//             }
//         }
//
//         this.ctx.textAlign = "center";
//         this.ctx.fillText(this.label, this.x + this.xSize / 2, this.y + this.ySize + 12);
//     }
//
//
//
// }
