var gameEngine = new GameEngine();

var ASSET_MANAGER = new AssetManager();



var socket = null;
if (window.io !== undefined) {
	console.log("Database connected!");

	// socket = io.connect('http://73.19.38.112:8888');

	// socket.on("connect", function () {
	// 	databaseConnected();
	// });
	
	// socket.on("disconnect", function () {
	// 	databaseDisconnected();
	// });

	// socket.addEventListener("log", console.log);
}

function reset() {
    const savedDisplayLevel = gameEngine.automata?.forest?.tradeDisplayLevel ?? 0;
    isRunning = true;
	loadParameters();
	gameEngine.entities = [];
	gameEngine.graphs = [];
	gameEngine.clickCapableGraphs = [];
	gameEngine.total_produced = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
	gameEngine.total_consumed = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
	gameEngine.total_lost    = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
	gameEngine.total_existing_actual   = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
	gameEngine.total_existing_expected = Array(PARAMS.numResources + PARAMS.numAlternativeResources).fill(0);
	Human.lastHumanId = 0;
	Trade.lastTradeId = 0;
	new Automata();
	gameEngine.automata.forest.tradeDisplayLevel = savedDisplayLevel;
	gameEngine.selection = new SelectionManager();
};



function pause() {
    isRunning = !isRunning;
};

function toggleSocialReach() {
    PARAMS.show_social_reach = !PARAMS.show_social_reach;
}

function clearHumanSelection() {
    gameEngine.automata.datamanager.humanDataView.clearSelection();
}

function cycleTradeLevel() {
    const forest = gameEngine.automata.forest;
    const trades = gameEngine.automata.trademanager.trades;
    const maxLevel = trades.reduce((m, t) => t.deprecated ? m : Math.max(m, t.level), 0);

    forest.tradeDisplayLevel = forest.tradeDisplayLevel >= maxLevel ? 0 : forest.tradeDisplayLevel + 1;
    forest.selectedTrade = null;

    const btn = document.getElementById('levelDisplayBtn');
    btn.textContent = forest.tradeDisplayLevel === 0
        ? 'Level Display: OFF'
        : `Level Display: L${forest.tradeDisplayLevel}`;
}



ASSET_MANAGER.downloadAll(function () {
	console.log("starting up da sheild");
	var canvas = document.getElementById('gameWorld');
	var ctx = canvas.getContext('2d');

	gameEngine.init(ctx);

	reset();

	gameEngine.start();
});




