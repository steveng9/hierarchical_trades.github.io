# Hierarchical Trades

An agent-based simulation of how trade norms, and then **norms about norms**, emerge from
purely local interaction — and of what that emergent hierarchy is *for*.

Agents on a resource landscape produce, metabolise, and reproduce. They cannot move, but each
has a **social reach** within which it can see neighbours and post a trade. Posting a trade
costs labour and earns the inventor the spread. Once a trade accumulates surplus, another
agent can build a trade *on top of it* — and the mechanism is the same at every level.

> **The core question:** can hierarchical institutions emerge from decentralised, rule-based
> trading — and if they do, what do they accomplish?

See **[RESEARCH.md](RESEARCH.md)** for the research agenda: the thesis, the six research
groups, and the experiment plan.

---

## Quick start

### Interactive

ES modules require a real HTTP server; `file://` will not work.

```bash
npm run serve          # python3 -m http.server 8000
open http://localhost:8000/index.html
```

### Headless experiments

Requires Node ≥ 22.5 (`brew install node`). **There are no npm dependencies** — the test
runner and SQLite are Node built-ins, so there is no `node_modules` and nothing to install.

```bash
npm run scenarios                                        # what can I run?
npm run mechanics                                        # what can I swap?

node src/experiment/cli.js run   --scenario baseline --seed 7 --ticks 2000
node src/experiment/cli.js sweep --scenario g1-value-accounting --seeds 1-10
node src/experiment/cli.js query --experiment g1-value-accounting --metric core.finalPopulation
```

### Tests

```bash
npm test               # 67 tests, ~60s
npm run test:slow      # adds the 1000-tick golden trajectory
```

---

## Architecture

The organising rule: **the kernel knows nothing about rendering, measurement, or
experiments.** Everything else attaches to it from outside.

```
src/
  core/         Pure simulation kernel. No DOM, no canvas, no globals, no Math.random.
    rng.js          Seeded PRNG (sfc32) with named substreams
    params.js       Parameter schema: defaults, types, ranges, validation
    simulation.js   The root object: owns rng, params, mechanics, ledger, events, world
    world.js        Population + forest + trade system
    human.js        Agent behaviour
    trade.js        Exchange, surplus routing, hierarchy
    trademanager.js Per-tick ordering, escrow settlement, retirement
    forest.js       Resource grid (state only)
    ledger.js       Resource accounting and conservation checks
    events.js       Event bus connecting kernel to probes
    statehash.js    Canonical trajectory digest

  mechanics/    Swappable rules. Every default reproduces historical behaviour.
    metabolism · valuation · pricing · reproduction · lifecycle · terrain · registry

  probes/       Measurement. Subscribes to events; the kernel never knows about metrics.
    core · tradelifecycle · value · hierarchy · traits · money

  scenarios/    One declarative file per research group.
  experiment/   Headless runner, parameter sweeps, SQLite + JSONL storage.
  render/       Canvas drawing. Reads the kernel, never mutates it.
  browser/      Interactive shell: app loop, context, DOM helpers.

test/           67 tests, including golden-trajectory regression fixtures.
tools/          Provenance tooling.
attic/          Pre-refactor code, not wired in. See attic/README.md.
```

**The interactive and headless paths share one kernel.** `sim.step()` is the only way the
world advances in either. A test asserts their trajectories are bit-identical.

---

## Reproducibility

Every run is fully determined by `(git SHA, scenario, parameters, seed)`.

- **No `Math.random()`** anywhere in `core`, `mechanics`, or `probes`. All randomness draws
  from an injected `Random`.
- **No static counters.** Ids live on the simulation, so two simulations in one process
  cannot interleave.
- **Provenance is recorded**, including whether the working tree was dirty. A result marked
  `code_dirty = 1` came from uncommitted code and should not go in a paper.

### Golden trajectories — please read before changing the kernel

`test/fixtures/golden-*.json` were captured from the **pre-refactor** flat scripts with a
seeded RNG, and `test/golden.test.js` asserts the current kernel reproduces them tick for
tick. This is what makes it safe to refactor or optimise the simulation.

If a golden test fails, the dynamics changed. That is only acceptable as a deliberate
decision — in which case recapture the fixture in the same commit and say why in the message.

Two consequences worth internalising:

1. **Do not "clean up" the unconditional random draws in the `Human` constructor.** They look
   wasteful and are load-bearing; the comment there explains why.
2. **New rules go in `mechanics/` as new named variants**, never as edits to a default.

---

## Swappable mechanics

A scenario names the variant it wants; the kernel calls it without knowing which was chosen.

| Mechanic | Default | Other variants |
|---|---|---|
| `metabolism` | `classic` | `linear` |
| `valuation` | `needOverHoldings` | `linearNeedOverHoldings`, `needOnly` |
| `pricing` | `dispersionSpread` | `fixedMargin` |
| `reproduction` | `asexualSplit` | `sexualBlend`, `none` |
| `lifecycle` | `idleWindow` | `graceCounter`, `never` |
| `terrain` | `wavy` | `stripes`, `slabs`, `randomResource`, `uniform` |

```js
new Simulation({
    params: {seed: 7, maxTradeLevel: 2},
    mechanics: {lifecycle: 'graceCounter', valuation: 'needOnly'},
});
```

---

## Experiment output

```
results/<experiment>/
  experiment.db                  SQLite: run manifests + scalar metrics
  <run-id>/
    config.json                  fully resolved params, mechanics, git SHA
    summary.json                 status, wall time, final state hash
    timeseries.jsonl             per-sample metrics from every probe
    trades.jsonl                 one row per retired trade (lifecycle probe)
```

`results/` is gitignored — runs are regenerable from their manifests.

Metrics are stored long-format so that adding a probe never requires a schema migration:

```sql
SELECT r.seed,
       r.params_json ->> '$.maxTradeLevel'                                  AS max_level,
       MAX(CASE WHEN m.key = 'core.maxLevelReached'  THEN m.value END)      AS depth,
       MAX(CASE WHEN m.key = 'value.finalFracPooled' THEN m.value END)      AS pooled
FROM runs r JOIN run_metrics m USING(run_id)
WHERE r.experiment = 'g1-value-accounting' AND r.status = 'ok'
GROUP BY r.run_id;
```

JSONL reads straight into pandas: `pd.read_json(path, lines=True)`.

---

## Adding a research direction

1. Add a probe in `src/probes/` and register it.
2. Add any new rule as a **named variant** in the relevant `src/mechanics/` module.
3. Add a scenario in `src/scenarios/` with its params, mechanics, probes, grid, and seeds.
4. Add a test.

The kernel should not need to change. If it does, that is worth a moment's thought — it
usually means the new idea wants a new event rather than new logic in `human.js`.

---

## Known limitations

These are real constraints on what can currently be claimed, not TODO noise.

- **`numResources` is capped at 3.** The terrain generators build length-3 cells and the
  renderer maps resources to RGB. This underpowers the money experiment (Group 5): on three
  nodes, betweenness is nearly degenerate. Lifting the cap is a prerequisite for a serious
  Mengerian result.
- **No defection.** Every agent obeys posted rates mechanically, so there is nothing to
  monitor or sanction. This blocks Ostrom principles 3–5 and Group 2 entirely. One mechanic
  (~60 lines) unlocks all three — see `src/scenarios/g2-enforcement.js`.
- **Trade lifespan is quantised by `clear_trades_every`** under the default `idleWindow`
  retirement policy. Survival analysis should use `lifecycle: 'graceCounter'`.
- **`humansWithinReach()` is O(n²) per tick** and dominates runtime (~27 ticks/s at 550
  agents headless; slower in-browser with rendering). A spatial hash grid is the obvious fix,
  and the golden tests make it safe to attempt.
- **`sexualBlend` reproduction is unvalidated** — not covered by goldens, and it makes
  reproduction density-dependent, coupling evolutionary to spatial dynamics.
- **`PARAMS.royalty` and `Trade.laborRequired`** are declared/computed but unread.
- **Group 3's network probe does not exist yet.** Terrain sweeps work today; graph and
  spectral measures do not.

---

## Interactive controls

**Space** pause/play · **Click + drag** on the forest spawns an agent (drag sets its reach) ·
**Shift + click + drag** selects a region · **Click a table row** to select a human or trade ·
**Level Display** cycles the hierarchy overlay OFF → L1 → L2 → …

Saved configurations live in `localStorage` and can be exported and imported as JSON.
Configs saved before a parameter existed still load: missing keys fall back to schema
defaults, unknown keys are ignored, and out-of-range values are clamped with a console
warning rather than breaking the page.

---

## Map key

| Indicator | Meaning |
|---|---|
| Red / green / blue cell tint | Resource concentration |
| White dot | Agent |
| Cyan circle with crosshairs | Selected agent |
| Green diamond (`inv`) | Trade inventor |
| Orange circle (`mgr`) | Manager of the selected trade |
| Black lines | Agents who exchanged through the selected trade |
| Orange lines / diamond | Parent trade's network and inventor (L2+ selected) |
| Blue dashed lines | Management hierarchy: managers → parent inventor |
