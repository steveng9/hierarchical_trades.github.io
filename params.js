var PARAMS = {

    // display settings
    margin: 20,
    show_social_reach: false,



    // sim
    updatesPerDraw: 10,
    reportingPeriod: 1, // in generations
    timing_update_interval: 500, // in ms
    show_timing: true,

    // environment / Forest
    cellSize: 50,
    width: 1000,
    height: 600,
    numResources: 3,
    roughness: 0.5,



    // humans
    initialHumans: 10,
    initialEnergy: 50,
    maxHumanEnergy: 100,
    maxHumanAge: 10000,
    basicEnergyDepletion: 0.01,
    workEnergyCost: 1,
    numAlternativeResources: 1, // i.e. labor, culture, currency, "order-keeping", etc.



    // trading
    laborPerResourceUnit: 0.2,
    fixTradeSurplusRatio: true, // if true, all trades will have the same Ain/Bin ratio


    // database
    db: "domesticationDB",
    collection: "test"
};

