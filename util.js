
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function average(arr) {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function meanAndStd(arr) {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  return { mean, std };
}

//GameBoard code below
function randomInt(n) {
    return Math.floor(Math.random() * n);
};

function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

function distance(a, b) {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
}

function generateNormalSample(mean = 0, stdDev = 1) {
    // box-muller transform
    let u1 = Math.random();
    let u2 = Math.random();

    let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
};

function sampleRightSkew(lambda = 1) {
    const u = Math.random();
    return -Math.log(1 - u) / lambda;
}

function logBase(base, x) {
    return Math.log(x) / Math.log(base);
}

// function shuffleArray(array) {
//     for (let i = array.length - 1; i > 0; i--) {
//       const j = Math.floor(Math.random() * (i + 1));
//       [array[i], array[j]] = [array[j], array[i]];
//     }
//     return array;
// };
function shuffleArray(arr) {
    // copy the original array so we don't mutate it
    const copy = arr.slice();  
    
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function numArray(n) {
    let arr = [];
    for(let i = 0; i < n; i++) {
        arr.push(i);
    }
    return arr;
};

function generateNormalSample(mean = 0, stdDev = 1) {
    // box-muller transform
    let u1 = Math.random();
    let u2 = Math.random();

    let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
};

function rgb(r, g, b) {
    return "rgb(" + r + "," + g + "," + b + ")";
};

function hsl(h, s, l) {
    return "hsl(" + h + "," + s + "%," + l + "%)";
};

function download(filename, text) {
    var pom = document.createElement('a');
    pom.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    pom.setAttribute('download', filename);
    pom.click();
};


function databaseConnected() {
    const dbDiv = document.getElementById("db");
    dbDiv.classList.remove("db-disconnected");
    dbDiv.classList.add("db-connected");
};

function databaseDisconnected() {
    const dbDiv = document.getElementById("db");
    dbDiv.classList.remove("db-connected");
    dbDiv.classList.add("db-disconnected");
};




function loadParameters() {


    PARAMS.initialHumans = parseInt(document.getElementById("initialHumans").value);
    
    
    console.log(PARAMS);
}

const runs = [
    {   
        runName: "02. wild type 2 - humans harvest randomly",
        harvestStrategy: "random",
        plantStrategy: "none",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.0,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },  
    {   
        runName: "03. wild type 3 - humans harvest and plant randomly",
        harvestStrategy: "random",
        plantStrategy: "random",
        humanAddRate: 100,
        plantSelectionChance: 0.0,
        plantSelectionStrength: 0.2,
        individualSeedSeparation: true,
        sharedPlantingSeeds: true,
    },
];
