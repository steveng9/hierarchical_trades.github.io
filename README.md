# Hierarchical Trades Simulation

An agent-based economic simulation that models how trade norms, institutions, and management hierarchies emerge from simple local interactions between resource-producing agents.

## Overview

Agents ("humans") are placed on a forest map with spatially distributed resources (Red, Green, Blue). They produce resources based on local concentration, metabolize them for energy, and reproduce when well-fed. Agents don't move, but have a **social reach** — a radius within which they can interact, discover trade opportunities, and establish norms.

The core question: **can hierarchical institutions emerge purely from decentralized, rule-based trading behavior?**

## How It Works

### Resources and Production
- The forest has three resources (R, G, B) distributed via smooth noise functions, creating regional specialization
- Agents produce resources proportional to their **productivity** and local **concentration**
- Agents with low production potential become **laborers**, generating labor units instead
- All agents metabolize resources for energy — they value a resource more when they need it and have less of it

### Reproduction
- When an agent's total energy exceeds `reproductionEnergyThreshold`, it splits: a child spawns nearby inheriting `socialReach` and `productivity` with small Gaussian mutation
- This keeps the population self-sustaining and allows selection to act on trade-building traits over time

### Level-1 Trades (Norms)
- An agent notices that nearby agents value resources differently (e.g., some have surplus R but need G)
- The agent spends labor to **establish a trade** — a fixed exchange rate between two resources
- The trade is shared with all agents within the inventor's social reach
- Any agent can invoke the trade if the exchange rate favors them
- The **inventor** receives surplus (the spread between the two sides) as royalties
- This models the emergence of **market norms** — commonly accepted exchange rates

### Level-2+ Trades (Hierarchical Institutions)
- A level-1 trade accumulates surplus resources in its supply
- An enterprising agent notices this surplus and establishes a **level-2 trade**: agents can exchange a resource for the level-1 trade's accumulated surplus
- Agents who invoke the level-2 trade become **managers** of the level-1 trade
- Once a trade has managers, surplus flows to the trade's supply instead of the inventor — redistributed through the hierarchy
- The level-2 trade inventor receives *that* level's surplus, until a level-3 trade is built on top, and so on
- **This is fully inductive** — the same mechanism creates level-3, 4, 5... trades with no special-casing

This loosely models how:
- **Markets** form (level-1 trades)
- **Companies** form around successful markets (level-2: managing a trade)
- **Managers of managers** emerge (level-3+: managing the management)
- **Institutions** are norms about norms about norms...

### Key Parameters
| Parameter | Description |
|-----------|-------------|
| `socialReach` | Per-agent radius for interaction (right-skewed distribution) |
| `productivity` | Per-agent production efficiency (0–1.2) |
| `surplus_multiplier` | Controls trade exchange rate spread |
| `minTradeSupplyForHierarchy` | Minimum supply a trade must accumulate before a higher-level trade can target it |
| `inventorPerpetualRoyalty` | Fraction of surplus inventor keeps after trade is managed (default: 0) |
| `reproductionEnergyThreshold` | Energy level at which an agent reproduces |
| `reproductionMutationRate` | Std dev of trait mutation on reproduction (as fraction of trait value) |

## Running

Open `index.html` in a browser. No build step required.

**Controls:**
- **Space**: Pause / Play
- **Reset Simulation**: Restart with current parameters (reads all UI sliders)
- **Toggle Social Reach**: Show/hide agent reach circles
- **Clear Selection**: Deselect all highlighted agents
- **Click + drag on forest**: Spawn a new agent (drag to set social reach)
- **Shift + click + drag on forest**: Select agents in a rectangle
- **Click on Human Data View rows**: Toggle highlight for individual agents
- **Click on Trade Data View rows**: Select a trade to visualize on the map
- **Find human / Find trade inputs**: Look up by ID; shows status if no longer alive

## Parameter UI & Saved Configs

The control panel exposes sliders for all major parameters across four sections: **Sim**, **Forest**, **Humans**, **Trading**, and **Hierarchical Trades**. Changes take effect on the next Reset.

**Saved Configurations** lets you name and store a full parameter snapshot to `localStorage`. Configs can be:
- **Loaded** — applies all saved params directly to the sim and resets (works even if the UI has changed since saving)
- **Exported** as a portable `.json` file
- **Imported** from a `.json` file (merges by name, useful for moving configs between local dev and GitHub Pages)

## Map Key

When a **trade is selected** in the Trade Data View, overlays appear on the forest map:

### Level-1 Trade Selected
| Indicator | Meaning |
|-----------|---------|
| **Black lines** between agents | Agents who have exchanged through this trade |
| **Green diamond** with "inv" label | The trade's inventor |
| **Orange circles** with "mgr" label | Agents who manage this trade (via a level-2 trade) |

### Level-2+ Trade Selected
| Indicator | Meaning |
|-----------|---------|
| **Orange lines** between agents | The *parent* trade's partner network (context layer) |
| **Orange diamond** | The parent trade's inventor |
| **Blue lines** between agents | This trade's own partner connections |
| **Blue dashed lines** (manager → inventor) | Management hierarchy: managers connected to parent trade inventor |
| **Orange circles** with "mgr" label | Managers of the parent trade |
| **Green diamond** with "inv" label | This trade's inventor |

All overlay lines use a dark outline for legibility against the colorful forest background.

### Agent Selection
| Indicator | Meaning |
|-----------|---------|
| **Cyan circle with crosshairs** | Selected/highlighted agent (via click or drag-select) |
| **Yellow circle** | Agent currently being spawned |
| **White dot with ID label** | Normal agent |

### Forest Background
- **Red/Green/Blue coloring** per cell represents resource concentration
- Brighter color = higher concentration of that resource

## Architecture

```
gameengine.js    — Main loop, rendering (draw runs every frame even when paused)
automata.js      — Simulation state, human lifecycle, birth counter
human.js         — Agent behavior: production, metabolism, trade building, reproduction
trade.js         — Trade execution, surplus distribution, hierarchical invocation
trademanager.js  — Trade lifecycle, cleanup, level tallies
forest.js        — Resource map, trade overlay rendering
params.js        — All tunable parameters
datamanager.js   — Stats aggregation, view layout
tradeview.js     — Two-table trade display (L1 upper, L2+ lower), trade selection/pinning
```

## Trade Data View

**Upper table** — Level-1 trades only, sorted by invocations:

| Column | Meaning |
|--------|---------|
| T# | Trade ID |
| Inv | Inventor's human ID |
| Exchange | `R <-> G` |
| Surplus | Combined surplus rate (surpluses.A + surpluses.B) |
| Invk | Total invocations |
| Volume | Total volume moved |
| Supply | Resources accumulated in the trade's supply |
| Mgrs | Number of managers |

**Lower table** — Level-2+ trades, sorted by level then invocations. Selecting a L2+ trade highlights its L1 ancestor in the upper table (orange).
