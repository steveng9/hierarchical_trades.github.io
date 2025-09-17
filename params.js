var PARAMS = {

    // display settings
    show_social_reach: false,
    margin: 20,
    leftpanelWidth: 450,
    rightpanelwidth: 630,
    canvaswidth: 1140,



    // sim
    updatesPerDraw: 100,
    reportingPeriod: 1, // in generations
    periodic_check_interval: 500, // in ms
    show_debug_info: true,

    // environment / Forest
    cellSize: 50,
    forestwidth: 1100,
    forestheight: 600,
    numResources: 2,
    roughness: 0.5,



    // humans
    initialHumans: 200,
    initialEnergy: 50,
    maxHumanEnergy: 100,
    maxHumanAge: 1000000,
    basicEnergyDepletion: 0.01,
    workEnergyCost: 1,
    numAlternativeResources: 1, // i.e. labor, culture, currency, "order-keeping", etc.
    production_labor_threshold: .4, // choose labor over production if production potential is less than this.
    laborPerCycle: 1,



    // trading
    laborPerResourceUnit: 0.2,
    fixTradeSurplusRatio: true, // if true, all trades will have the same Ain/Bin ratio
    surplus_multiplier: .1,
    build_labor_per_reach: 1/20,
    expected_volume_multiplier: 1/2,
    clear_trades_every: 200,
    royalty: .5,


    // database
    db: "domesticationDB",
    collection: "test"
};

