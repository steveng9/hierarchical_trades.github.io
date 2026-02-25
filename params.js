var PARAMS = {

    // display settings
    show_social_reach: false,
    margin: 20,
    leftpanelWidth: 450,
    rightpanelwidth: 750,
    canvaswidth: 1240,



    // sim
    updatesPerDraw: 10,
    reportingPeriod: 1, // in generations
    periodic_check_interval: 500, // in ms
    show_debug_info: true,

    // environment / Forest
    cellSize: 50,
    forestwidth: 1100,
    forestheight: 600,
    numResources: 3,
    roughness: 1,
    undulation_cutuff: .3,



    // humans
    initialHumans: 400,
    initialEnergy: 50,
    maxHumanEnergy: 100,
    maxHumanAge: 1000000,
    basicEnergyDepletion: 0.01,
    workEnergyCost: 1,
    numAlternativeResources: 1, // i.e. labor, culture, currency, "order-keeping", etc.
    production_labor_threshold: .5, // choose labor over production if production potential is less than this.
    laborPerCycle: 1,
    reproductionEnergyThreshold: 99,  // total energy required to reproduce (out of maxHumanEnergy)
    reproductionMutationRate: 0.1,    // std dev as fraction of trait value



    // trading
    laborPerResourceUnit: 0.2,
    fixTradeSurplusRatio: true, // if true, all trades will have the same Ain/Bin ratio
    surplus_multiplier: .2,
    build_labor_per_reach: 1/3,
    expected_volume_multiplier: 2,
    clear_trades_every: 100,
    royalty: 1,

    // hierarchical trades
    inventorPerpetualRoyalty: 0,        // fraction of surplus inventor keeps forever after trade is managed (0 = all goes to trade.supply)
    minTradeSupplyForHierarchy: 5,      // minimum accumulated supply in a trade before a level-2+ trade can target it
    hierarchicalTradeCostMultiplier: .1, // building a hierarchical trade costs more labor than level-1
    min_rate_improvement: 0,            // minimum fractional improvement in XinXout over best existing trade to justify building (0 = allow all)


    // database
    db: "domesticationDB",
    collection: "test"
};

