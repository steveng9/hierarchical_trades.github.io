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
