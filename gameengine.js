// This game shell was happily copied from Googler Seth Ladd's "Bad Aliens" game and his Google IO talk in 2011

var isRunning = true;

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (/* function */ callback, /* DOMElement */ element) {
                if (isRunning) {
                    window.setTimeout(callback, 1000 / 60);
                }
            };
})();


class Timer {
    constructor() {
        this.gameTime = 0;
        this.maxStep = 0.05;
        this.wallLastTimestamp = 0;
        this.ticks = [];
    }
    tick() {
        var wallCurrent = performance.now();
        var wallDelta = (wallCurrent - this.wallLastTimestamp) / 1000;
        this.wallLastTimestamp = wallCurrent;

        var gameDelta = Math.min(wallDelta, this.maxStep);
        this.gameTime += gameDelta;

        this.ticks.push(wallDelta);

        let index = this.ticks.length - 1;
        let sum = 0;
        while (sum <= 1 && index >= 0) {
            sum += this.ticks[index--];
        }
        index++;

        this.ticks.splice(0, index);

        return gameDelta;
    }
};


class GameEngine {
    constructor() {
        this.entities = [];
        this.graphs = [];
        this.clickCapableGraphs = [];
        this.ctx = null;
        this.surfaceWidth = null;
        this.surfaceHeight = null;

        
        // Track updates per second
        this.updateCount = 0;
        this.updatesPerSecond = 0;
        this.lastSecond = performance.now();

        // Verify sim elements are correct
        this.total_produced = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.total_consumed = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.total_existing_actual = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
        this.total_existing_expected = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
    }
    init(ctx) {
        this.ctx = ctx;
        this.surfaceWidth = this.ctx.canvas.width;
        this.surfaceHeight = this.ctx.canvas.height;
        this.timer = new Timer();
    }
    start() {
        console.log("starting game");
        var that = this;
        (function gameLoop() {
            that.loop();
            requestAnimFrame(gameLoop, that.ctx.canvas);
        })();
    }
    startInput() {
    }
    addEntity(entity) {
        this.entities.push(entity);
    }
    addGraph(graph) {
        this.graphs.push(graph);
    }
    draw() {
        if (this.automata.generation % PARAMS.reportingPeriod === 0) {
            // Clear forest area
            this.ctx.clearRect(PARAMS.margin, PARAMS.margin, PARAMS.forestwidth, PARAMS.forestheight);
            for (var i = 0; i < this.entities.length; i++) {
                this.entities[i].draw(this.ctx);
            }

            // Clear panels area (full width below forest)
            const panelsY = PARAMS.margin + PARAMS.forestheight + PARAMS.margin;
            this.ctx.clearRect(0, panelsY, this.ctx.canvas.width, this.ctx.canvas.height - panelsY);
            for (var i = 0; i < this.graphs.length; i++) {
                this.graphs[i].draw(this.ctx);
            }
            for (var i = 0; i < this.clickCapableGraphs.length; i++) {
                this.clickCapableGraphs[i].draw(this.ctx);
            }

            this.selection?.draw(this.ctx);
        }
    }


    update() {
        var entitiesCount = this.entities.length;

        for (var i = 0; i < entitiesCount; i++) {
            var entity = this.entities[i];

            if (!entity.removeFromWorld) {
                entity.update();
            }
        }

        for (var i = this.entities.length - 1; i >= 0; --i) {
            if (this.entities[i].removeFromWorld) {
                this.entities.splice(i, 1);;
            }
        }
    }

    loop() {
        if (isRunning) {
            this.clockTick = this.timer.tick();
            var loops = PARAMS.updatesPerDraw;
            while (loops-- > 0) {
                this.update();
                this.updateCount++;
            }
            this.draw();
            


            if (PARAMS.show_debug_info) {
                const now = performance.now();
                const delta = now - this.lastSecond;
                if (delta >= PARAMS.periodic_check_interval) {
                    // sim speed
                    this.updatesPerSecond = this.updateCount / (delta / 1000);
                    this.updateCount = 0;
                    this.lastSecond = now;

                    // total resources check
                    for (let r = 0; r < (PARAMS.numResources); r++) {
                        this.total_existing_actual[r] = this.automata.sum_all_resources(r);
                        this.total_existing_expected[r] = this.total_produced[r] - this.total_consumed[r];
                    }
                }

                
            }
        }
    }
};








