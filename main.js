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
    isRunning = true;
	loadParameters();
	gameEngine.entities = [];
	gameEngine.graphs = [];
	lastHumanId = 0;
	new Automata();
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



ASSET_MANAGER.downloadAll(function () {
	console.log("starting up da sheild");
	var canvas = document.getElementById('gameWorld');
	var ctx = canvas.getContext('2d');

	gameEngine.init(ctx);

	reset();

	gameEngine.start();
});




