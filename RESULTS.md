# Experiment Results

*Raw findings from sweeps and experiments. Inform future experiment design; not for publication as-is.*

---

## Hierarchy-Depth Sweep — 2026-09-02

**Question:** How does maximum trade level affect carrying capacity?

**Setup:** `maxTradeLevel ∈ {0, 1, 2, 3, 4, 5, 6, ∞}` × 5 seeds (12351–12355), 5000 ticks each, 8 parallel workers. All other params at default (level-6-stable preset).

**Final population at tick 5000:**

| Depth | s12351 | s12352 | s12353 | s12354 | s12355 | Mean |
|-------|--------|--------|--------|--------|--------|------|
| 0     | 0      | 0      | 0      | 0      | 0      | 0    |
| 1     | 5487   | 5496   | 4108   | 5318   | 4081   | 4898 |
| 2     | 8283   | 7680   | 3995   | 6696   | 2239   | 5779 |
| 3     | 5687   | 7875   | 4391   | 6550   | 2237   | 5348 |
| 4     | 3709   | 5544   | 4234   | 6841   | 838    | 4233 |
| 5     | 3635   | 6275   | 3445   | 6305   | 1034   | 4139 |
| 6     | 3974   | 7200   | 1976   | 6720   | 1012   | 4176 |
| ∞     | 3974   | 7588   | 2003   | 6720   | 1095   | 4276 |

**Observations:**

1. **No trade = extinction.** Every seed dies at depth 0. Trade is necessary for survival.
2. **Depth 2 is the sweet spot.** Mean pop ~5780, an ~18% boost over L1-only (~4900). One level of meta-coordination above direct barter maximizes carrying capacity under these params.
3. **Deeper hierarchy doesn't help further.** Depths 3–7 settle around 4100–4300, slightly *below* L1-only. The overhead of deeper trade trees may not pay for itself — or the additional institutional structure may lock up resources in `trade.supply[]` pools that don't circulate fast enough.
4. **Depth 6 ≈ unlimited.** Allowing deeper hierarchy beyond 6 produces nearly identical results, suggesting the system self-limits around depth 6 regardless of the cap.
5. **High seed variance.** Seed 12355 consistently produces the smallest populations (838–2239 for depth ≥2), while seeds 12351/12352/12354 are much larger. Spatial layout (initial agent placement + terrain) matters a lot. More seeds needed for tighter confidence intervals.

**Caveats / open questions for follow-up:**

- Only 5 seeds — variance is high, especially at deeper levels. 20–30 seeds per cell recommended for paper-quality data.
- Only final population measured. Time-series data (population trajectory, trade counts, resource velocity) would reveal whether deep hierarchies start strong and decline, or never gain traction.
- The `bestRate` trade selection bug (noted in RESEARCH.md §0) was not active — all runs used `invokeAll`. Results under `bestRate` would likely differ.
- No lifecycle logging was active — can't yet say whether deep hierarchies fail because trades die faster, or because resources get trapped in trade supply pools.
- These params are the level-6-stable preset. Different base parameters (especially `social_reach_multiplier`, terrain roughness, population density) could shift the sweet spot.

**Relevance to theses:**

- **Thesis C (non-monotonic welfare):** Supported — the relationship is clearly non-monotonic, peaking at depth 2 and declining. But "extractive" is not yet demonstrated; need the Group 1 value-accounting decomposition to distinguish "overhead cost" from "rent extraction."
- **Thesis B (depth as environmental readout):** This sweep held the environment constant and varied the cap. The next step is the inverse: hold the cap at ∞ and vary the environment (roughness × density × reach), measuring emergent L_max.

---

## Scheduled-End (Institutional Term Limits) — 2026-09-18

*External investigation, logged verbatim from the professor's writeup ("The Price of Immortal Institutions"). Sim was run **unmodified**; every new rule was dropped in at runtime as a policy object in the mechanics directory. 2,895 total runs across 5 terrain generators. Registered predictions were append-only, including failures. Provenance verified by re-running stored configs and comparing full state hashes.*

**Core finding.** Under the current mechanics, the only death trigger for a trade institution is disuse — a throughput signal. Institutions that capture traffic are immune to the only pathway that can retire them, and their posted rates drift the furthest from what the world now implies. Adding a second death trigger that ignores usage (a **scheduled end** — random termination with per-tick probability `p`) sweeps population from ~856 (p=0) to ~1437 (p=1.0). Zero worlds went extinct at any rate. The benefit is essentially complete by p=0.05.

**Scheduled-end sweep (baseline terrain, 20 worlds/point):**

| p (scheduled-end rate) | Humans     | Mispriced volume | Total volume | Hierarchy depth | Institution lifespan |
|------------------------|------------|------------------|--------------|-----------------|----------------------|
| none (0)               | 856 ±111   | 0.514            | 106k         | 5.15            | 317                  |
| light (0.05)           | 1358 ±99   | 0.451            | 125k         | 4.75            | 247                  |
| moderate (0.35)        | 1382 ±103  | 0.275            | 159k         | 3.90            | 132                  |
| maximal (1.0)          | 1437 ±107  | 0.172            | 196k         | 2.40            | 75                   |

At p=1 no institution survives a single cleanup window, yet the *population* of institutions is undiminished (120 standing, 2,807 built over a run). Institutional capacity is not what's spent.

**Two instruments, one ceiling — stacking cap × scheduled end (480 runs, 30 seeds/cell):**

| Cap        | p=0        | p=0.05     | p=0.35     | p=1.0      |
|------------|------------|------------|------------|------------|
| 1 (no hier.) | 1311 ±91  | 1339 ±75   | 1461 ±76   | 1462 ±99   |
| 2          | 1116 ±101  | 1392 ±91   | 1324 ±85   | 1412 ±71   |
| 3          | 984 ±115   | 1290 ±74   | 1360 ±93   | 1434 ±108  |
| unlimited  | 856 ±111   | 1358 ±99   | 1382 ±103  | 1437 ±107  |

Every route reaches ~1440–1460. **Substitutes, not additive:** scheduled end buys +581 at unlimited cap but only +152 ±105 at cap 1; cap buys +455 at p=0 but +36 ±90 at p=1.

**Terrain gate (paired within seed):**

| Terrain          | Specialisation | Depth at rest | Mispricing | Effect of scheduled end |
|------------------|----------------|---------------|------------|-------------------------|
| uniform          | none           | 0.00          | 0.010      | −17 ±15                 |
| wavy             | smooth grad.   | 0.70          | 0.737      | +76 ±96                 |
| slabs            | blocks         | —             | —          | uninhabitable (0/30 start) |
| stripes          | bands          | 4.86          | 0.432      | +615 ±94                |
| randomResource   | maximal        | 5.15          | 0.514      | +581 ±115               |

Registered gate passed: where there are no gains from trade, a scheduled end is worth nothing. **Replicates** on `stripes` (+615 ±94). **4× world size:** +2016 ±265 in 27/29 worlds.

**Two distinct harms, different dose-response shapes:**

| p    | Humans | Communities at end | Largest community's share |
|------|--------|--------------------|---------------------------|
| 0    | 856    | 1.3                | 77%                       |
| 0.05 | 1358   | 1.6                | 77%                       |
| 0.35 | 1382   | 3.0                | 70%                       |
| 1.0  | 1437   | 4.3                | 57%                       |

Population jumps 0 → 0.05 while structure barely moves. Structure breaks up 0.35 → 1.0 while population is already flat. A regime tuned to protect members would leave consolidation untouched. (Communities via label propagation on trade graph weighted by shared constituents; robust to three link thresholds.)

**Four mechanism hypotheses — all withdrawn:**

1. **Accumulation** (population builds a stratum it can't rebuild after a knock). Ramped disturbance up to 60% institutional death and back returns to within +0.021 ±0.017 of an untouched world. Earlier deficit was specific to *targeted* removal (best-first).
2. **Mispricing cleanup.** Cap buys +455 for 0.514→0.403; scheduled end buys +581 for 0.514→0.172. Three times the cleanup for a comparable gain. Settling cell: no-hier + no-end reaches 1,311 while still carrying 0.403 mispriced volume.
3. **Hierarchy suppression alone.** Survived the terrain gradient (effect tracked depth-at-rest, not volume), then falsified by a two-resource world with depth 4.15 and no benefit (−33 ±177).
4. **Preventing consolidation.** Population saturates where structure barely moves; structure breaks where population is flat.

Phenomenon replicates and has boundary conditions; **channel is not identified.**

**Two honest limits:**
- The purge is partial. What an institution passes on to *what was built on it* falls by 89% under churn; what its trading left in the ground falls only 32%.
- This model can price what depth costs but not what depth is *worth*. Scheduled end flattens hierarchy; the value of that hierarchy is not represented.

**Follow-up questions for our sim work:**

- Is there a way to represent "what hierarchy is worth" endogenously (e.g., latency, aggregation gains, information compression) so the depth cost can be netted against a benefit rather than a null?
- Instrument the **staleness curve by age** (professor observed 0.175 → 0.450 → 0.691 → 0.638 → 0.522 across age cohorts). Confirm on our baseline; check whether it's an artefact of the disuse trigger or intrinsic to frozen terms.
- Instrument **activity concentration** (professor: oldest cohort holds 42% of all institution-time; volume-weighted mispricing 0.514 > unweighted 0.387). Reproduce in-tree.
- Add a **scheduled-end policy object** under `src/mechanics/` (or wherever the institution-lifecycle triggers live) as an opt-in second death trigger, sitting alongside the existing disuse trigger — matching the shape the professor used.
- Sweep should be paired **within seed** (his design), and predictions registered append-only in `RESULTS.md` / `RESEARCH.md` before each batch.
- The **randomResource** terrain the professor used is our current baseline; the `stripes` replication is a candidate for our own second-gate.
- Investigate **channel identification** — his four withdrawals suggest the effect is real but the mechanism isn't accumulation, mispricing cleanup, hierarchy suppression, or de-consolidation individually. What's left? (Interaction of two? A fifth?)

**Source:** Professor's Claude artifact `1c9f8d9e-f67a-4653-9ab6-3e90e9879103` (access-gated; contents copied into conversation 2026-09-18).
