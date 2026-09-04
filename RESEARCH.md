# Research Agenda — Hierarchical Trades

*Living document. Started 2026-08-22. The parking lot for every idea, triaged.*

**Purpose of this file:** to get the idea space out of working memory and onto disk, so that
"there are so many things to try" stops being a reason to freeze. Nothing here is lost.
Everything here is *scheduled* — into Paper 1, Paper 2, Paper 3, or the blog.

---

## 0. The core reframe

Two output channels, and they were being conflated:

- **The paper** needs one claim and ~3 figures. It is a *cut*, not a survey.
- **The Substack** needs no thesis at all. "I varied the map geometry, look what happened" is
  a complete post.

Most of the backlog is blog material that was being held to paper standards. Route it to the
blog and it stops blocking.

**Discipline for Paper 1: change as little of the sim as possible.** Every mechanic added
before data generation is another ablation a reviewer will demand. The sim as it stands is
already interesting enough to carry one paper.

---

## 1. Two load-bearing mechanisms already in the code

These emerged from the implementation rather than being designed. They are the thesis.

### 1a. Hierarchy can only bootstrap when the inventor dies

Trace `distributeSurplus()` (`trade.js:170`). Surplus reaches `trade.supply[]` in exactly two
cases: the inventor is dead, or the trade already has managers. Managers only exist once a
child trade has been *invoked*; a child can only be *built* when
`parentTrade.supply[R] >= minTradeSupplyForHierarchy` (`human.js:245`). Even at
`minTradeSupplyForHierarchy = 0`, `invokeHierarchical` needs non-zero parent supply to yield
`fulfilledOut > EPSILON` and register a manager.

One entry point to the whole hierarchy:

> founder dies → rent stream loses its claimant → trade becomes an ownerless pool of surplus
> → someone builds an L2 trade to intermediate access → invokers of that L2 trade become
> managers of the L1 trade.

This is a **succession problem**, and hierarchy is the system's answer to it.

### 1b. Management is reach extension — this is what hierarchy is *for*

`isWithinReach()` (`trade.js:207`) checks the inventor **and every manager**;
`flushNewManagers()` pushes the trade into `my_trades` for everyone near each new manager.
Managers are permanent until death. Each manager is a new broadcast node for the norm.

A norm with no hierarchy above it is confined to one dead agent's circle. A norm with a
hierarchy above it recruits managers and its catchment grows monotonically.

### 1c. The counterweight (already in code)

`deprecate()` cascades **downward** (`trade.js:230`), and an L1 dies if either side goes
uninvoked for one `clear_trades_every` window. The whole institution is hostage to its base
market going quiet. **Hierarchy buys robustness to individual loss and pays in systemic
fragility.** The decapitation and cascade experiments (Group 4) are the paired test of this.

---

## 2. Thesis candidates

### Thesis A — **SELECTED for Paper 1**. Institutions are how norms outlive and outgrow their inventors.

> Norms are costly to create and their creators capture the rents. But a creator's influence is
> bounded spatially (reach) and temporally (death). A second-order layer emerges endogenously
> that converts ownerless rent into distributed management, and its emergent function is to
> extend a first-order norm's spatial reach and lifespan beyond what any individual can
> sustain. Hierarchy is not imposed and is not merely coordination; it is the answer to
> succession.

Falsifiable, and every measurement already exists on the objects.

### Thesis B — Depth of institutional hierarchy is a readout of the environment, not of the design.

The build rule is genuinely level-agnostic; that is the thing built and worth defending. Show
that `L_max` is a smooth emergent function of resource patchiness x population density x reach
distribution. The phase diagram is the strongest evidence that this is emergence and not a
hand-coded ladder. **Role in Paper 1: the emergence evidence supporting A.**

### Thesis C — Hierarchy's welfare effect is non-monotonic.

The question a reviewer will ask, so own it. Prior: intermediate depth helps (it scales the
norm), deep hierarchies extract (each level skims a spread from the same flow). If the data
says monotonically extractive, that is *also* a strong result — "emergent institutions in this
model are rent-seeking all the way down." **Role in Paper 1: the evaluation.**

### The ALife-native framing

Pitch as an **economic major transition**. In the code, `Trade` and `Human` are interchangeable
*because both have `supply[]`* — the product of an interaction becomes a first-class
participant in further interaction of the same kind. That is Maynard Smith & Szathmáry's
structure, and ALife responds to it.

**Related work to engage:**

- **Waring, Goff & Smaldino (2017), *Ecological Economics* 131:524–532** — the anchor for the
  cultural-evolution-of-institutions claim. **Must be cited and built off, not re-derived.**
  See §2.5.
- **Waring, Goff & Smaldino (2015), CoMSES model 4627 (NetLogo, CC-BY-4.0)** — their code is
  public. Run it before claiming novelty. See §2.5.
- **Andrews, Clark, Hillis & Borgerhoff Mulder (2024), *Nature Sustainability* 7:404–412** —
  cultural evolution of collective property rights; the current state of the art on *where
  Ostrom's principles come from*. **Directly overlaps our Group 2 pitch.** See §2.5.
- **Axtell (1999), "The Emergence of Firms in a Population of Agents"** — nearest prior work.
  Must be engaged directly.
- Epstein & Axtell, *Sugarscape*
- Simon, *The Architecture of Complexity* — hierarchy as solution, near-decomposability
- Maynard Smith & Szathmáry — major evolutionary transitions
- Ostrom, *Governing the Commons* — esp. principle 8 (see Group 2)
- Menger; Kiyotaki & Wright — origin of money (Group 5)
- Lewis / Schelling / Hayek — conventions, focal points, price as information (the honest
  framing for norms-without-defection; see Group 2)
- Open-endedness: Taylor, Bedau
- North — institutions and economic performance

---

## 2.5 The anchor literature — *cultural group selection of institutions*

**Status: load-bearing. These are not "related work" to name-drop in paragraph three; they are
the papers this project is a continuation of.** Anything below that this sim would merely
re-demonstrate is *out of scope permanently*, and anything the sim does that these papers
cannot do is the actual contribution. Read all three (and run the second) before generating
Paper 1's data — not after.

### The three

1. **Waring, T. M., Goff, S. H., & Smaldino, P. E. (2017).** *The coevolution of economic
   institutions and sustainable consumption via cultural group selection.* **Ecological
   Economics, 131, 524–532.** https://doi.org/10.1016/j.ecolecon.2016.09.022

2. **Waring, T. M., Goff, S. H., & Smaldino, P. E. (2015).** *Cultural Group Selection of
   Sustainable Institutions* [computational model, v1.2.0, NetLogo, CC-BY-4.0]. **CoMSES
   Computational Model Library.** https://www.comses.net/codebases/4627/releases/1.2.0/

3. **Andrews, J., Clark, M., Hillis, V., & Borgerhoff Mulder, M. (2024).** *The cultural
   evolution of collective property rights for sustainable resource governance.* **Nature
   Sustainability, 7, 404–412.** https://doi.org/10.1038/s41893-024-01290-1
   (Max Planck Institute for Evolutionary Anthropology / Boise State. Verify the author list and
   check for the published Author Correction, s41893-024-01315-9, before citing.)

### What they establish — *and therefore what we must not claim*

**Waring, Goff & Smaldino (2017).** A spatial evolutionary model of endogenous group formation
and dissolution over a renewable common-pool resource, with the evolutionary pressure measured
separately at each organisational level. Headline results: conservation behaviour and the
institutions that support it arise chiefly when groups compete *indirectly*, for longevity,
rather than by direct conflict; and sustainable outcomes require **exclusive property regimes**,
which arise most readily under group-structured cultural evolution.

**Andrews et al. (2024).** Collective property rights over a common-pool resource, evolving
culturally. Headline results: institutions emerge **sequentially** — a group must secure its
*boundary/access* institution before an internal *harvest* institution can take hold; support
for both waxes and wanes cyclically rather than ratcheting; **learning from out-groups** is
what lets sustainable arrangements be found at all ("a group in isolation … is often doomed");
and inter-group *conflict* undermines the internal norms that inter-group *competition*
promotes.

**Claims now closed to us. Do not spend a figure on any of these:**

- "Institutions can emerge from cultural evolution rather than design." Established (both).
- "Group-structured / multilevel selection can favour costly cooperative institutions."
  Established (2017).
- "Exclusivity and defined boundaries matter for sustainable resource use." Established (2017,
  2024) — and 2024 owns the *emergence* of Ostrom's Principle 1 specifically.
- "Institutional support is non-monotonic over time." Established (2024). If our trades show
  waxing/waning, that is a **replication**, and should be reported and cited as one — which is
  worth more than pretending it is new.

⚠️ **The Group 2 novelty claim needs qualifying.** The line "ABM work on Ostrom is saturated
with monitoring-and-sanctions models and has almost no *generative* account of where the
principles come from" was written before these were on the desk. Andrews et al. (2024) is
exactly such a generative account — for **P1**. The claim survives only in its narrow form:
*no generative account of **P8, nested enterprises** specifically.* Rewrite the Group 2
paragraph accordingly (done below) and never state the broad version.

### What this sim does that they do not — *this is the contribution*

| Dimension | Waring et al. / Andrews et al. | Here |
|---|---|---|
| What an institution *is* | A trait/rule slot on a group, from a designer-specified menu (property regime; access rule; harvest rule) | A **constructed object** (`Trade`) with its own state, `supply[]`, rate, lifespan, and reach — invented at a cost, not selected from a list |
| Where groups come from | Groups are the unit of selection; membership is modelled explicitly | **There are no groups.** Catchment (`isWithinReach` + manager set) is entirely emergent and each institution has its own, overlapping others |
| Nesting | Assumed or absent; P8 is a design principle, not an outcome | **Endogenous and unbounded.** The build rule is level-agnostic; L_max is an output |
| Selection level | Individual vs. group, two fixed tiers | Institution-level selection over a lattice of institutions whose *own* products become institutions |
| The dilemma | Conservation is individually costly — a genuine cooperation problem | **No defection** (see §3). Ours is a convention/coordination model, not a commons dilemma |

The one-sentence positioning: *prior cultural-evolution models show that pre-specified
institutions can be selected; this model shows institutions being **built**, and shows nesting —
Ostrom's P8 — arising as an emergent solution to founder succession rather than as a listed
design principle.*

### Concretely build off, don't reinvent

- **Run their code (2015 CoMSES release) before writing the novelty sentence.** It is NetLogo,
  CC-BY-4.0, publicly downloadable. Two hours with it converts a hedge into a claim, and
  reviewers of an ALife/EcolEcon paper will assume we have done this. Note anything their
  model already produces that we were planning to present as new.
- **Borrow their measurement, not their mechanics.** The 2017 paper's contribution is partly
  *how* it decomposes selection pressure by organisational level. Port that decomposition to
  our units — individual agent vs. trade vs. hierarchy tree — instead of inventing a bespoke
  statistic for Group 1's value-accounting figure. Same machinery, new level of organisation:
  that is a clean, citable move.
- **Their competition/conflict distinction is a free hypothesis for Group 3 and 4d/4e.** 2024
  finds competition builds institutions while conflict corrodes them. Our sim currently has
  *neither* explicitly — but trade competition (`min_rate_improvement`, redundant-trade churn)
  is indirect competition, and it is already a swept axis. Frame that sweep as a test of their
  result at the institution level.
- **Indirect competition for longevity (2017) is our survival analysis (4a).** Their mechanism
  — institutions spread because their carriers *persist*, not because they win fights — is
  precisely Thesis A's mechanism. Cite it as the theoretical precedent for the Kaplan–Meier
  figure, and state that we are testing it where the "group" is an institution's catchment.

### Two of their results are direct, cheap predictions for our sim

Both are testable with Group 0 logging and no new mechanics. Either outcome is publishable, and
framing them as *tests of published results* is far stronger than presenting them as
observations.

- **P-Sequential (from Andrews et al.):** boundary institutions must precede internal
  regulation. Our analogue: does a trade's **reach/manager set** expand before its **rate**
  becomes locally load-bearing — i.e. do L2 trades appear over L1 trades that have already
  grown their catchment, rather than over high-volume but narrow ones? Log catchment area and
  manager count at the tick each child is built (4a already records both). **Confirming a
  Nature Sustainability result in a model with no groups and no designed institutions is a
  genuinely strong paragraph.**
- **P-Cyclical (from Andrews et al.):** support waxes and wanes rather than ratcheting. Our
  analogue: is invocation volume per trade cyclical over its lifespan? Falls out of the
  lifecycle log for free.

### Where they must appear in Paper 1

Not one clumped citation block — four specific places:

1. **Abstract/intro:** cultural evolution can select institutions (Waring 2017); we ask where
   the *nesting* comes from.
2. **Related work:** the table above, honestly — including that we have no defection and they do.
3. **Methods/measurement:** multilevel decomposition ported from Waring et al.
4. **Discussion:** P-Sequential and P-Cyclical as replication-or-contrast against
   Andrews et al. (2024).

### Honest exposure

§3 records that this sim has no defection. Against these three papers that is sharper than it
looks: both of theirs are built on a genuine cooperation dilemma, and ours is not. **Say so in
the related-work section rather than letting a reviewer find it.** The convention/focal-price
reframe is the defence, and it is a real one — but it must be stated next to these citations,
not on its own. This also raises Group 2 (defection + manager-as-monitor) from "nice extension"
to **the thing that puts this model on the same footing as the anchor literature.** Paper 2 is
now more load-bearing than it looked.

---

## 3. The known weakness — decide the answer before submitting

**There is no defection.** Every agent obeys the posted rate mechanically (`favorsTrade` →
`invoke`). "Norm" is therefore doing unearned work, and the Ostrom framing from the earlier
Q-learning post has nothing to attach to.

Two honest options:

- **Reframe (cheap, chosen for Paper 1):** these are *conventions / focal prices* in the
  Lewis–Schelling–Hayek sense, not commons dilemmas. Defensible, and it means the earlier
  Q-learning post's Ostrom thread is a different project — which is fine, it becomes Paper 2.
- **Add minimal defection (Paper 2):** see Group 2.


---

# The Six Groups

Ideas cluster far harder than they look. Roughly twenty backlog items collapse to five
substantive groups plus a refactor bin. Group 0 is infrastructure and gates everything.

---

## Group 0 — Infrastructure *(gates all of Paper 1; do first)*

Not a research group; a prerequisite. Without this there is no paper, only anecdotes.

| Item | Cost | Note |
|---|---|---|
| **Seeded RNG** | M | `Math.random()` is scattered through `util.js`, `human.js`, `forest.js`. Swap in mulberry32 behind `PARAMS.seed`. |
| **Headless runner** | M | Node entry point looping `automata.update()` with no canvas, dumping per-tick CSV. Draw path is already separated, so mostly stubbing `ctx`. |
| **`PARAMS.maxTradeLevel`** | S | The control condition that does not currently exist. Needed for L0 (no trades) / L1-only / L2-cap / uncapped. |
| **Replicates + sweep driver** | S | 20–30 seeds per parameter cell, minimum. |
| **Trade lifecycle logging** | S | birth tick, death tick, inventor, level, parent, catchment area over time, manager count, volume, cause of death. Feeds nearly every figure. |
| **Structural metrics module** | S | max depth, branching factor, tree-size distribution, share of total volume through L>=2, manager-count distribution. |

**Sim changes needed for Paper 1 — and only these:**

| Change | Cost | Why |
|---|---|---|
| Seeded RNG + headless + CSV | M | Gates everything |
| `maxTradeLevel` cap | S | The missing control condition |
| `surplusToTradeFraction` | S | Turns the founder-death accident into a swept variable (Group 4) |
| Trade lifecycle logging | S | Feeds all survival/resilience figures |
| Soften deprecation (decay, not binary window) | S | Lifespan is currently an artifact of `clear_trades_every: 50` and **will confound the survival analysis** |
| Explicit founder-ghost parameter | S | Dead inventors still project reach forever (`isWithinReach` keeps the ref, x/y persist). Defensible, but make it a *choice*, not a leak |
| Simplify `metabolize()` **once, then freeze** | S | `human.js:396` uses a nonlinear deficit-weighted update that makes every welfare number hard to interpret. Do this before generating any data. |

**Code housekeeping / open questions:**
- `trade.laborRequired` computed in the constructor but appears unused — confirm before a
  reviewer asks.
- `PARAMS.royalty` declared but appears unused — same.
- `min_rate_improvement: 0` means redundant trades proliferate; churn is controlled entirely by
  same-inventor dedup + deprecation. Sweeping it gives a clean **"competition intensity" axis** —
  cheap and worth one figure panel.
- **`bestRate` trade selection is broken or over-selective.** Under `invokeAll`, a good
  hierarchical sim sustains indefinitely. Switching to `bestRate` with identical params causes
  the sim to limp and eventually die off. Hypothesis: agents become too picky about rates,
  moving far less total volume through trades, ignoring hunger signals in favour of rate
  optimality. Needs investigation — is the selection logic itself wrong, or does it just need
  a fallback that says "invoke *something* if you're starving, even at a bad rate"?
- **Conservation drift ("Lost R") is growing too fast.** The `core` probe's `drift` metric
  should hover near zero (rounding noise over many ticks of accounting). Instead it grows
  steadily, suggesting a real resource leak — resources being created or destroyed without
  proper bookkeeping. Needs a systematic audit: trace every `supply[]` credit/debit,
  `metabolize()` consumption, death cleanup, trade deprecation, and reproduction energy
  transfer. Consider adding a true conservation check that independently sums all resources
  in the sim (agent holdings + trade supply pools + terrain stocks) and compares against
  cumulative production minus cumulative consumption, so the reported number reflects actual
  leaks rather than accounting-formula drift.

---

## Group 1 — Value accounting: is hierarchy productive or extractive?

*One experiment, one figure. Absorbs five separate backlog items.*

**Collapsed from:** do managers starve the system (suck up resources) · does a fiefdom emerge
and is it concretely productive vs. waste · how wealth accumulates among inventors / laborers /
managers · how value accrues locally vs. system-wide · is total value equal to total labor put
in, or is value added elsewhere · how laborer/manager/inventor proportions change over time and
why that matters for a self-functioning society.

These are all the same instrumented run viewed through different columns.

**Claim it supports:** Thesis C.

**Design:** `maxTradeLevel ∈ {0, 1, 2, 3, ∞}` × 30 seeds.

**Outcomes to log:**
- equilibrium population, total population energy, average energy
- resource circulation velocity (volume moved per unit resource in system per tick)
- resource-balance: how close agents get to even R/G/B metabolism (the actual point of trade)
- Gini of energy; Gini of royalties
- **role decomposition:** energy and wealth share held by laborers vs. producers vs. inventors
  vs. managers, as time series. Role proportions over time.
- **the value-conservation ledger:** total labor spent building trades vs. total surplus
  extracted vs. total gain in metabolic efficiency. Does the hierarchy add value or move it?
  `gameEngine.total_produced / consumed / lost` already exist and should balance —
  extend them to attribute by role.
- **starvation check:** resources sitting in `trade.supply[]` are *out of circulation*. Track
  the fraction of all resources parked in trade supply vs. held by agents, by hierarchy depth.
  This is literally "do managers starve the system," and it is a one-line measurement.

**Note:** the fiefdom question ("is this fief useful or waste?") is answerable per-tree, not
just in aggregate — compute, for each hierarchy tree, the metabolic benefit delivered to its
participants vs. the surplus it retained. Expect high variance; the distribution is the story.

### 1b. Spatial advantage and role fitness

Is it better to be a producer in the interior (high concentration, fast depletion) or at the
edge (lower concentration, less competition)? Do laborers or producers accumulate more energy?
Who reproduces more — the high-energy producer on rich ground, or the laborer who builds the
norms that let everyone else trade? Decompose reproduction rate by role and by distance from
resource-region boundaries. This extends the role decomposition above with a spatial and
evolutionary dimension: if laborers reproduce less, their niche shrinks over time, which
constrains how much institution-building the economy can afford.

---

## Group 2 — Defection, enforcement, and Ostrom *(Paper 2)*

*One missing mechanic, not eight missing principles.*

**Collapsed from:** the 8 Ostrom principles · what enforcement looks like · deviation from
norms · increasing/decreasing friction for mechanisms.

### The 8 principles mapped onto the actual code

| Principle | Status |
|---|---|
| 1. Clearly defined boundaries | **Already present.** `isWithinReach` + `my_trades` membership = spatial boundary of who holds rights to the norm. **But Andrews et al. (2024) own P1's emergence — cite them, don't claim it (§2.5)** |
| 2. Congruence with local conditions | **Already present.** Rate is fit to local mean/std of neighbour valuation ratios (`human.js:170`). Prices are locally congruent by construction |
| 3. Collective-choice arrangements | Missing. Trades are posted unilaterally, never amended |
| 4. Monitoring | Missing — but manager reach is a monitoring radius waiting to happen |
| 5. Graduated sanctions | Missing |
| 6. Conflict resolution | Missing. Expensive. **Skip permanently** |
| 7. Right to organize | Arguably `build_labor_per_reach` = the cost barrier to organizing. Meta. Skip |
| 8. **Nested enterprises** | **This is literally the sim.** |

### Two consequences

**Principle 8 is the ALife pitch.** ABM work on Ostrom is dominated by monitoring-and-sanctions
models (P4/P5), and the generative work that does exist targets P1 — Andrews et al. (2024) give
a full cultural-evolutionary account of *where boundary institutions come from*. **No one has a
generative account of P8, nesting.** That narrow claim is the one to make; see §2.5 for why the
broad version ("no generative account of the principles") is now false and must not be written.
Abstract-worthy sentence: *"Nested enterprises are not a design principle here; they are an
emergent solution to succession."*

**There are not six missing principles, there is one missing mechanic.** P3, P4, P5 all require
that a norm can be *violated*. Add defection once and monitoring, sanctions, and rule revision
all become reachable.

### The minimal defection mechanic (~60 lines)

Agents may invoke a trade without surrendering the spread, with probability `defection_rate`.
A manager within reach of a defector detects and delists them (removal from `my_trades`).

Why this is elegant: **the manager's reach becomes simultaneously the distribution radius and
the monitoring radius.** Hierarchy is then both a distribution network and an enforcement
network — which is precisely the original intuition ("institutions are norms about enforcement
of norms"), with no bolt-on machinery.

### Follow-ons once defection exists
- **Graduated sanctions (P5):** delisting duration scaling with repeat offences.
- **Collective choice (P3):** allow rate revision — by the inventor, by managers, or by vote of
  invokers. Three variants, three different institutions. Which produces longer-lived norms?
- **Friction knobs:** `build_labor_per_reach`, `hierarchicalTradeCostMultiplier`,
  `min_rate_improvement`, `clear_trades_every`, escrow clearing frequency. Each is a friction
  parameter; sweep as a family. *"Which frictions are load-bearing for institution formation?"*
  is a legitimate standalone result.

---

## Group 3 — Economic geography and network topology *(Paper 3)*

**Collapsed from:** changing map properties/layout/geometry · how villages form · cross-society
networks and trade routes · how village trade affects overall metabolism and reproduction · how
a local village spreads and branches into new communities topologically over time · spectral
properties and other topological measurements · reproduction location as a driver of migration
over generations.

**Candidate claim:** the topology of the resource landscape determines the topology of the
institutional network, and institutional depth is highest at the *boundaries* between resource
regions, not in their interiors.

(Intuition worth testing early and cheaply: surplus is proportional to valuation *dispersion*,
which is maximised where regions with different specialisations meet. If true, institutions
should nucleate on borders — a clean, visual, very ALife-friendly result.)

**Threads:**
- **Map geometry as an experimental axis.** Already a lot to play with: `roughness`,
  `undulation_cutoff`, `cellSize`, and hand-authored layouts — islands, corridors, gradients,
  checkerboards, one-resource-per-quadrant, ring worlds. Beyond procedural terrain, hand-craft
  **controlled topology experiments** with deliberately shaped barren regions and bottlenecks:
  - **Barren deserts** — large dead zones (zero or near-zero resource) of various shapes
    (circular, bands, irregular) separating fertile regions. Do communities on opposite sides
    develop independently? Does anyone colonise the desert, and if so, do they survive only by
    trading with the fertile edges? A barren ring surrounding a fertile interior tests whether
    institutions can form in isolation vs. requiring contact.
  - **Narrow land bridges** — two rich regions connected by a corridor only a few cells wide.
    Width is the experimental axis: at 1 cell wide, only one or two agents can physically
    occupy the bridge; at 5–10 cells, a small community can form there. How does bridge width
    affect (a) whether inter-community trade emerges at all, (b) the hierarchy depth of bridge
    trades, (c) whether norms cascade across vs. stop at the bottleneck? Relates directly to
    the hub-agent thread below.
  - **Archipelago** — many small fertile islands in a barren sea, varying island size and
    inter-island distance. At what island size is a community self-sustaining (all 3 resources
    present)? At what inter-island distance do trade links form between islands? Does a
    stepping-stone chain of islands produce relay trading (resource hopping island to island)?
  - **Resource gradient** — a smooth linear gradient from all-red on the left to all-blue on
    the right, with green uniform everywhere. Institutions should form along the gradient at
    the points where red and blue agents first need each other. The gradient slope is the
    experimental axis: steep = sharp boundary, shallow = gradual mixing.
  - **Oasis** — a single rich patch surrounded by vast barren land with a thin resource trickle.
    Tests whether a small isolated community can sustain hierarchy, and what minimum population
    / resource density is needed for each level.
  - **Labyrinth / maze** — fertile corridors separated by barren walls, forcing long-distance
    resource flow through winding paths. Does hierarchy depth correlate with path length between
    resource sources? Do institutions form at corridor junctions (the nodes of the maze graph)?
  - **Asymmetric abundance** — one huge resource region adjacent to one tiny one. The small
    region has something the large one needs. Does the small community punch above its weight
    institutionally because it controls a scarce resource? Power asymmetry in trade networks.
- **Village formation and branching.** Reproduction spawns children 5–30px away, so lineages
  drift. Over generations this *is* migration. Track settlement clusters as a spatial graph over
  time; watch them bud. Phylogeny of villages.
- **Trade routes between villages.** Does inter-village trade emerge, and does it measurably
  improve metabolism and reproduction rate on both sides? Compare isolated vs. connected
  clusters.
- **Resource fluidity and hop distance.** How many intermediaries does a resource pass through
  before it reaches an agent who lacks it? An agent on a pure-green cell needs red — does it
  come directly from a red-cell neighbor, or does it travel through a chain of traders? Does
  hierarchy extend the hop distance (L2+ trades moving supply between trade pools)? Measurable
  by tagging resource transfers and tracking origin-to-destination path length. If resources
  travel farther in hierarchical economies, that is a concrete mechanism by which hierarchy
  extends the division of labour beyond local reach.
- **Network measures.** Build the agent–agent trade graph (`trade.trade_partners` already
  records normalized pairs with timestamps) and the trade–trade hierarchy graph. Then:
  degree distribution, clustering, betweenness, modularity/community detection,
  **spectral properties** (Laplacian spectrum, algebraic connectivity/Fiedler value as a measure
  of how close a society is to fissioning, spectral gap vs. institutional depth).
  Hypothesis worth stating: *the Fiedler value predicts village branching before it happens.*
- **Reproduction-driven movement.** Deliberately vary spawn distance to make migration a tunable
  axis; watch the frontier expand and institutions either follow or fail to.
- **Distance-dependent trade friction.** Currently a trade that gains managers becomes a
  fully-connected graph across the whole map — any participant can trade with any other within
  reach, regardless of how far apart they are. Introduce a simple friction that makes
  longer-distance invocations more expensive: the extra cost flows to the manager/trade supply
  (carrying a trade over distance is work). This should (a) keep trade networks spatially
  compact and realistic — short-range trades dominate, long-range ones are rare and costly,
  (b) create a *reason* for hierarchy to exist at each scale (local L1s feed into regional L2s
  that bridge the gap), and (c) **improve performance** by reducing the effective trade graph
  from O(n²) fully-connected to something sparser. The mechanic must be simple and must not add
  per-agent search cost — a distance multiplier on the spread, or a distance-proportional tax
  deposited into `trade.supply[]`, not a shortest-path computation. The performance aim matters:
  whatever we add should reduce asymptotic strain, not increase it.
- **Trade awareness diffusion (word-of-mouth).** Currently a trade's reach is strictly
  inventor circle ∪ manager circles. A popular trade in a large dense community can end up
  confined to a small spatial pocket if it never recruits managers who happen to extend coverage.
  Add a lightweight spreading mechanic: non-manager agents who participate in a trade can spread
  awareness to neighbors within their own reach, with some probability per invocation or per
  tick. This makes trade catchment grow organically through use, not just through the accident of
  which managers get recruited. Combined with distance friction above, the two mechanics create a
  tension: trades *want* to spread (word-of-mouth) but long-range participation is costly
  (friction), so the emergent catchment is a smooth decay rather than a hard circle.
  **Experimental dimensions this opens:** how does average reach affect trade spread? Low-reach
  producers vs. high-reach producers? Laborers vs. producers vs. managers with different reach
  distributions? How does community health change as a function of these? The `socialReach`
  trait is already heritable with mutation (6a), so these questions have an evolutionary
  dimension for free.
- **Inter-community hub agents and norm bridging.** When two dense communities are separated by
  a resource boundary (e.g. a red-rich region adjacent to a blue-rich region), agents in the
  gap between them are positioned to facilitate exchange of each region's scarce resource.
  Several interrelated questions:
  - **Hub topology.** Do bridge agents between communities become high-betweenness hubs in the
    trade graph? When a single hub can't sustain the demanded volume, do *links form around the
    hub* — i.e. does the bridge widen from one agent to a corridor of agents who collectively
    serve the inter-community flow?
  - **Hierarchy level and position.** Is trade level correlated with position between resource
    hotspots? If a hub agent is mediating red↔blue exchange between regions scarce in the other,
    does it need to work through higher-level trades to move sufficient volume, or are L1 trades
    perfectly sufficient? Hypothesis: the volume demanded by two communities exceeds what a
    single L1 trade can carry, so hierarchy emerges *at the bridge* to scale throughput — making
    inter-community boundaries a nucleation site for depth, complementing the Group 3 candidate
    claim about institutional depth at resource-region boundaries.
  - **Norm cascading across community borders.** Currently, norms appear to stop spreading at
    the boundary between touching communities — a trade popular in one cluster does not
    propagate into the adjacent one, even when hub agents participate in it. The desired
    behaviour: once a norm passes through a connecting hub agent, it should *cascade* into the
    new community via that agent's local connections. This is closely related to the
    **word-of-mouth diffusion** thread above — the spreading mechanic is the mechanism that
    would enable cascading, and **distance friction** is the counterweight that prevents a
    single norm from homogenising both communities. Together the three threads (friction,
    word-of-mouth, hub bridging) form a coherent package: norms spread locally through use,
    pay a cost for distance, and cross community boundaries via hub agents who seed them into
    the new population.
  - **Benefit vs. detriment of bridge trade level.** Once inter-community trade exists, is it
    better carried by deep or shallow hierarchy? Deep trades move more volume but skim more
    spread; shallow trades are cheaper but may bottleneck. Measure community welfare (metabolic
    balance, population, energy) as a function of the level of the dominant bridge trade.
  - **Map designs for this thread.** Two-island or dumbbell layouts (two resource-rich clusters
    connected by a narrow corridor) make the hub dynamics legible. Also ring-world with
    alternating resource bands, and the existing `randomResource` terrain at high roughness
    (natural clustering).

---

## Group 4 — Norm survival and resilience *(Paper 1 core — Thesis A)*

**Collapsed from:** properties of norms/institutions that survive, thrive, or die off. Plus the
resilience experiments.

### 4a. Survival analysis — *the direct test of Thesis A*
Kaplan–Meier of L1 trade lifespan, stratified by whether the trade ever acquired a child.
Second panel: catchment area over time. Third: fraction of trades surviving their founder's
death, with vs. without hierarchy.
**~40 lines of logging.** This is the paper's page-1 figure if Thesis A leads.

*Prerequisite:* soften deprecation first, or lifespan is quantised by `clear_trades_every`.

Also record, for every trade: rate spread, resource pair, inventor reach, local population
density at founding, number of competing trades at founding. Then ask which of those predict
survival. "What makes a norm durable?" is directly answerable.

Add two fields for the anchor-literature tests in §2.5: **catchment area and manager count at
the tick each child trade is built** (P-Sequential), and **invocation volume per trade over its
lifespan** (P-Cyclical). Both are one extra column in the same log, and they turn this figure
into a test of Andrews et al. (2024) rather than a standalone observation.

Theoretical precedent to cite here: Waring et al.'s (2017) finding that institutions spread
through *indirect competition for longevity* rather than direct conflict — the same mechanism
Thesis A proposes, measured where the persisting unit is an institution's catchment rather than
a group.

### 4b. The founder-death experiment — *the most title-worthy single result*
Add `PARAMS.surplusToTradeFraction`: the fraction of surplus pooling in `trade.supply[]` even
while the inventor lives. At 0 = current behaviour (hierarchy requires death); sweep upward so
hierarchy can bootstrap from a living founder's treasury.

> **Must the founder die for the institution to form?**

Right now the answer is yes, and it was arrived at by accident. Turning an accident into a swept
parameter is exactly how it becomes a finding.

### 4c. Phase diagram of `L_max` — *Thesis B*
`undulation_cutoff` / `roughness` (patchiness) × `initialHumans` (density) ×
`social_reach_multiplier`. The money figure for emergence.

### 4d. Decapitation
Kill the top-*k* trade inventors at tick T. Measure recovery time, with and without hierarchy.
Prediction: hierarchical economies absorb it (managers carry the norm); flat ones do not.

### 4e. Cascade fragility
Kill *base* L1 trades and watch `deprecate()` take whole trees down. Lost volume as a function
of tree depth. **The counter-result to 4d** — and 4d + 4e together make a far better paper than
either alone: hierarchy trades individual-level robustness for systemic fragility.

### 4f. Environmental shock
Shift the noise field, or crash `resourceRegenRate`, mid-run. Do deep hierarchies reorganise or
shatter? Speaks to the institutional-rigidity literature.

---

## Group 5 — Emergence of money *(free; measurement only)*

**Collapsed from:** introduction/emergence of a "money" product or pseudo-product.

**Zero new mechanics.** Per resource, compute the fraction of active trades it appears in and
its **betweenness in the trade graph**. If one resource becomes the hub intermediary, that is a
Mengerian emergence-of-money result obtained for free.

~30 lines. Ship it as a side result in Paper 1 and as its own Substack post.

**Extensions (later, and only if the free version shows something):**
- Does the money resource stay stable, or does the system switch currencies after a shock?
- `numAlternativeResources` is already 1 (labor). A pure token with no metabolic value is the
  natural next step — does a *fiat* pseudo-product emerge, or does money have to be edible here?
- Is the money resource the most abundant, the most evenly distributed, or the most *dispersed
  in valuation*? Menger predicts saleability; this sim can adjudicate.
- **Abundance vs. scarcity as a driver of tradedness.** Does the most abundant resource get
  traded most (because it is available to offer), or the scarcest (because demand for it is
  highest)? Decompose trade volume and active-trade count by resource, and correlate with
  total concentration in the landscape. If scarce resources attract more institutional
  infrastructure, that speaks to whether norms form around *need* or around *availability* —
  which matters for the convention-vs-commons framing.

---

## Group 6 — Refactors, not theses *(deliberately deferred)*

**Collapsed from:** rebuilding reproduction as an evolutionary/sexual mechanic · genes for
social reach and productivity · tuning/simplifying the metabolism mechanism · dynamic vs.
static environment · varying the number of resources (1, 2, 3, 4, …).

**These are the trap.** Each feels like progress and produces no claim on its own, and each
invalidates previously generated data. Rule: **do not touch these before Paper 1's data is
generated**, with one exception.

| Item | Verdict |
|---|---|
| Simplify `metabolize()` | **Exception — do it now, once, then freeze.** Prerequisite for interpretable welfare numbers |
| Sexual reproduction + explicit genome | Defer. Real value, but it is a Paper 2/3 mechanic. Note that heritable `socialReach`/`productivity` with gaussian mutation *already* provide an evolutionary channel — see 6a |
| Dynamic environment | Defer — but note it is already half-built (`resourceDepletion` + `resourceRegenRate` + `baseGrid`). The shock experiment (4f) is the cheap version |
| Varying `numResources` | Defer to a Substack post. `numResources = 2` is a useful *debugging* configuration, though: hierarchy dynamics become legible by hand |
| Parent location / migration | Belongs to Group 3, not here |

### 6a. Energy-dependent production
Currently, the only consequence of low energy is inability to reproduce (below
`reproductionEnergyThreshold`). Production output and labor capacity are flat regardless of an
agent's energy state. This means an agent running on empty produces just as much as a
well-fed one — the only penalty is demographic.

Make production or labor output scale with current energy. The simplest version: a multiplier
on `production_max` or `laborPerCycle` that drops as energy falls (e.g. linear in
`energy / maxHumanEnergy`, or a threshold below which output degrades). This creates a
**feedback loop**: poor diet → low energy → low production → less to trade → even lower energy.
Trading and dietary diversity become load-bearing for *individual* productivity, not just
reproduction. The community-level consequence is that non-trading populations don't just fail
to grow — they actively decline in output, making the difference between trading and non-trading
economies visible in per-agent metrics, not only in demographics.

**Experimental value:** re-run the hierarchy-depth sweep with this mechanic on. If hierarchy
improves dietary diversity (via broader resource circulation), the productivity feedback should
amplify the welfare gap between deep and shallow economies — making Thesis C's measurement
sharper.

### 6b. The one evolutionary result that is already free — *do this in Paper 1*
Heritable `socialReach` and `productivity` with mutation already exist. Track their joint
distribution over time, hierarchy on vs. off.

**Prediction: hierarchy opens a niche for high-reach / low-productivity "institution builders"
that does not exist otherwise.** A genuine evolutionary result, already instrumented, no new
mechanics. If it holds it is one of the better figures available.

---

# Prioritised plan

### Paper 1 — *Succession* (ALife submission)
Thesis A, with B as emergence evidence and C as evaluation.

- Group 0 in full (infra + the seven listed sim changes, nothing more)
- Group 4a, 4b, 4c (survival, founder-death, phase diagram) — the core
- Group 4d + 4e (decapitation + cascade) — the resilience pair
- Group 1 (value accounting) — the evaluation
- Group 5 (money) and Group 6a (institutional niche) — free side results
- Framing: conventions/focal prices, **not** commons dilemmas. Cite Axtell directly.
  Lead the abstract with Ostrom's principle 8 as the thing that is emergent here.
- **Position against the anchor literature (§2.5) explicitly** — Waring, Goff & Smaldino
  (2017/2015) and Andrews et al. (2024). Four placements, the ported multilevel decomposition,
  and the P-Sequential / P-Cyclical tests. Non-optional; skipping it is how this paper gets
  desk-rejected as redundant.

**Everything else is out of Paper 1.** That is the whole discipline.

### Paper 2 — *Enforcement*
Group 2. One new mechanic (defection + manager-as-monitor) unlocking Ostrom P3–P5 on top of the
P1/P2/P8 the sim already exhibits.

### Paper 3 — *Economic geography*
Group 3. Topology, villages, trade routes, spectral measures, migration.

### Substack — continuously, unconstrained
Map geometry experiments · resource-count sweeps · money emergence · village branching
timelapses · metabolism tuning · anything visually interesting. No thesis required. This is the
pressure valve: it is where the buffet belongs.

---

## Build status — updated 2026-08-24

**Group 0 (infrastructure) is complete.** The simulation was refactored from flat browser
scripts into `src/` (kernel / mechanics / probes / scenarios / experiment / render / browser),
verified bit-for-bit against golden trajectories captured from the pre-refactor code. 67 tests
pass. See README.md for the architecture and `npm run scenarios` for what is runnable.

| Group 0 item | Status |
|---|---|
| Seeded RNG (sfc32, named substreams, no `Math.random` in kernel) | ✅ `src/core/rng.js` |
| Headless runner + CSV/JSONL output | ✅ `src/experiment/` |
| `maxTradeLevel` control condition | ✅ param; `0` = no trades, `1` = L1 only, `null` = unlimited |
| `surplusToTradeFraction` (founder-death sweep, 4b) | ✅ param, default 0 = historical |
| Replicates + sweep driver with resume | ✅ `src/experiment/sweep.js` |
| Trade lifecycle logging | ✅ `src/probes/tradelifecycle.js` |
| Structural metrics | ✅ `src/probes/hierarchy.js` |
| Softened deprecation policy | ✅ `lifecycle: 'graceCounter'` |
| Explicit founder-ghost parameter | ✅ `founderGhostReach`, default true = historical |
| Run database (SQLite + JSONL, git SHA + dirty flag) | ✅ `src/experiment/store/` |
| Simplify `metabolize()`, once, and freeze | ⬜ **not done** — `metabolism: 'linear'` exists as a variant but is not the default; switching requires recapturing goldens |

### Group status

| Group | Status | Blocker |
|---|---|---|
| 1 Value accounting | **Ready** | — |
| 2 Enforcement / Ostrom | **Blocked** | Needs the compliance + enforcement mechanics (~60 lines). Spec in `src/scenarios/g2-enforcement.js` |
| 3 Geography | **Partial** | Terrain sweeps run today; the network/spectral probe is unwritten |
| 4 Succession | **Ready** | — |
| 5 Money | **Ready but underpowered** | `numResources` capped at 3; betweenness is near-degenerate. Needs the cap lifted to be a real test |
| 6 Evolution | **Ready** | — (`sexualBlend` exists but is unvalidated and not needed for 6a) |

**Pilot signal, not a result:** a single 300-tick seed showed trades that acquired children
living 286 ticks against 156 for those that did not. One seed, heavy censoring, default
(quantising) retirement policy. Encouraging; not evidence.

---

## Immediate next actions

1. ~~Write this file~~ ✅
2. ~~Group 0: seeded RNG → headless runner → `maxTradeLevel` → lifecycle logging~~ ✅
3. **Read the three anchor papers and download + run the CoMSES NetLogo model (§2.5).** Do this
   before generating data, not before writing it up — it can still change what Paper 1 measures.
4. Simplify `metabolize()`, once, and freeze it (recapture goldens in the same commit).
5. **Optional but high-value first:** replace the O(n²) `humansWithinReach()` with a spatial hash
   grid. It dominates runtime (~27 ticks/s at 550 agents), so it sets the budget for every sweep
   below, and the golden tests make it safe to attempt.
6. First real question, answerable in an afternoon:
   `node src/experiment/cli.js sweep --scenario g1-value-accounting --seeds 1-10`
   — **does hierarchy pay?** (Group 1)
7. Then Group 4: survival analysis under `graceCounter`, and the `surplusToTradeFraction` sweep.

---

## Standing notes to self

- Fruitfulness is the failure mode, not the asset. The cut is the work.
- If a new idea arrives: it goes *in this file*, in a group, with a paper tag. It does not go
  into the sim.
- Resist adding mechanics before data. Every mechanic is a future ablation request.
- The sim is already interesting enough to carry one paper as-is. That is the thing that is
  easiest to disbelieve and most important to act on.
- **Check every new idea against §2.5 before it gets a group.** If Waring et al. or Andrews
  et al. already showed it, it is a citation, not an experiment.

---

## References

**Anchor literature — cite thoroughly, build off, do not duplicate (see §2.5):**

- Waring, T. M., Goff, S. H., & Smaldino, P. E. (2017). The coevolution of economic institutions
  and sustainable consumption via cultural group selection. *Ecological Economics*, 131,
  524–532. https://doi.org/10.1016/j.ecolecon.2016.09.022
- Waring, T. M., Goff, S. H., & Smaldino, P. E. (2015, August 4). *Cultural Group Selection of
  Sustainable Institutions* (Version 1.2.0) [computational model]. CoMSES Computational Model
  Library. https://www.comses.net/codebases/4627/releases/1.2.0/
- Andrews, J., Clark, M., Hillis, V., & Borgerhoff Mulder, M. (2024). The cultural evolution of
  collective property rights for sustainable resource governance. *Nature Sustainability*, 7,
  404–412. https://doi.org/10.1038/s41893-024-01290-1
  *(Author list and page range compiled from the publisher record and the Santa Fe Institute
  announcement — verify against the PDF, and check the Author Correction s41893-024-01315-9,
  before the citation goes into a manuscript.)*

Remaining related work is listed informally in §2 and should be formalised here as it is
actually read.
