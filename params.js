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
    cellSize: 25,
    forestwidth: 1100,
    forestheight: 600,
    numResources: 3,
    roughness: 1,
    undulation_cutuff: .4,
    resourceDepletion: true,
    resourceDepletionRate: 0.02,  // concentration depleted per unit produced
    resourceRegenRate: 0.0045,    // concentration restored per tick (per cell)



    // humans
    initialHumans: 500,
    initialEnergy: 50,
    maxHumanEnergy: 100,
    maxHumanAge: 1000000,
    production_max: 3,
    basicEnergyDepletion: 0.023,
    workEnergyCost: 2,
    numAlternativeResources: 1, // i.e. labor, culture, currency, "order-keeping", etc.
    production_labor_threshold: .75, // choose labor over production if production potential is less than this.
    laborPerCycle: 4,
    reproductionEnergyThreshold: 90,  // total energy required to reproduce (out of maxHumanEnergy)
    reproductionMutationRate: 0.1,    // std dev as fraction of trait value
    social_reach_multiplier: 0.4,


    // trading
    laborPerResourceUnit: 0.2,
    fixTradeSurplusRatio: true, // if true, all trades will have the same Ain/Bin ratio
    surplus_multiplier: .2,
    build_labor_per_reach: 0.35,
    expected_volume_multiplier: 2,
    clear_trades_every: 50,
    royalty: 1,

    // hierarchical trades
    inventorPerpetualRoyalty: 0,        // fraction of surplus inventor keeps forever after trade is managed (0 = all goes to trade.supply)
    minTradeSupplyForHierarchy: 1,      // minimum accumulated supply in a trade before a level-2+ trade can target it
    hierarchicalTradeCostMultiplier: .1, // building a hierarchical trade costs more labor than level-1
    min_rate_improvement: 0,            // minimum fractional improvement in XinXout over best existing trade to justify building (0 = allow all)


    // database
    db: "domesticationDB",
    collection: "test"
};


