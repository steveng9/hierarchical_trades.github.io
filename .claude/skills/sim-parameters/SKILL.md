---
name: sim-parameters
description: Look up what any Hierarchical Trades sim parameter does (filterable by panel — Sim/Forest/Humans/Trading/Hierarchical Trades/Mechanics), and make quick edits to a slider's min/max/step/format, or add/remove a parameter from the control panel. Use whenever the user asks what a parameter does, what's tunable in a given panel, or asks to change a slider's range/step/precision or add/remove a control.
user-invocable: true
---

# Sim Parameters

This project deliberately keeps parameter data in one place rather than duplicated into this
skill, so nothing here goes stale as parameters are added or retuned. Always read the source
files fresh — don't answer from memory of a previous run of this skill.

## Where things live

- **`src/core/params.js`, `PARAM_SCHEMA`** — the authoritative list of every tunable parameter
  in the simulation, including ones with no UI control. Each entry has `default`, `type`
  (`int`/`float`/`bool`/`string`), optional `min`/`max`, a `group`, a `doc` string
  explaining what it does and why it matters, and optionally `usedBy` — which mechanic
  variants read it (see "Mechanic relevance" below).
- **`PARAM_GROUPS`** in the same file — the canonical group order: `run`, `environment`,
  `agents`, `trading`, `hierarchy`, `network`, `display`.
- **`src/mechanics/registry.js`, `describeMechanics()`** — the swappable rule *families*
  (list them with `describeMechanics()`; there are more than a handful) and their named
  variants, plus `FAMILY_REQUIRES`: when a family is active at all. Each variant's own behavior is documented in its module
  (`src/mechanics/<family>.js`), not in the registry.
- **`index.html`, inside `<div id="parameters">`** — the actual control panel. Each control is
  a `<div class="param-row">` with a label and an `<input>` (or `<select>` for mechanics)
  whose `id` matches a `PARAM_SCHEMA` key exactly. Sliders carry their own `min`/`max`/`step`
  and an `oninput` handler that formats the adjacent `_val` span — this is the *only* place
  step size and display precision live; the schema doesn't track them.
- **`src/browser/domutil.js`** — `readParameterInputs()`/`writeParameterInputs()` walk
  `#parameters input` by `id` generically. Adding or removing a `param-row` needs no changes
  here.

### Panel ↔ schema group mapping

The UI's `<h3>` panel headings don't exactly equal `PARAM_SCHEMA` groups — some `group`s split
across panels or have no UI presence at all. Confirmed by reading `index.html` directly:

| UI panel               | Schema group(s)              | Notes |
|-------------------------|-------------------------------|-------|
| Sim                     | `run`, part of `display`      | Only `seed` and `updatesPerDraw` are exposed; most of `display` (margin, canvaswidth, panel widths, reportingPeriod, show_debug_info, show_social_reach) has no slider. |
| Forest                  | `environment`                 | All exposed. |
| Humans                  | `agents`                      | All exposed. |
| Trading                 | `trading`                     | All exposed. |
| Hierarchical Trades     | `hierarchy` (partial)         | `founderGhostReach`, `surplusToTradeFraction`, `maxTradeLevel`, `tradeLoyaltyThreshold` are schema-only, no slider yet. |
| Mechanics               | n/a — reads `MECHANICS_REGISTRY` conceptually, but `<option>` lists are hand-written | See "Mechanics" below — adding a variant does *not* auto-populate the dropdown. |

Re-derive this table by re-reading `index.html` if it's been a while — panels drift. The
panel also hides rows, whole sections, and mechanic selectors that the currently selected
mechanics don't use, so "what's in panel Y" depends on the mechanics: answer for the defaults
unless the user names a selection, and use `relevantParams(selection)` from
`src/mechanics/relevance.js` to get the exact list.

## Answering "what does param X do?" / "what's tunable in panel Y?"

1. Open `src/core/params.js` and read `PARAM_SCHEMA`.
2. For a specific param, find its key and report `doc`, `default`, `type`, `min`/`max`.
3. For a panel, filter by `group` using the mapping table above, then list each key's `doc`.
4. Check whether the key has a `<input id="...">` in `index.html` — if not, say so; the user
   may want it added (see below).
5. For a mechanic family, use `describeMechanics()`'s shape (`variants`, `default`) and, if the
   user wants a variant's *behavior*, read that variant's implementation in
   `src/mechanics/<family>.js` — the registry only names them.

## Changing a slider's min/max/step/display format

Two files move together — this is the part that's easy to get half-right:

1. **`index.html`**: edit the `<input type="range" id="<key>" min=... max=... step=...>` and
   its `oninput` (the `.toFixed(n)` / rounding there is the *display* format; it doesn't affect
   the stored value's precision).
2. **`src/core/params.js`**: if the new slider `max` exceeds the schema's `max` (or the new
   `min` is below the schema's `min`), raise the schema bound to match.
   **This step is not optional.** The browser resolves parameters with
   `resolveParams(overrides, {clampRanges: true})` (see `src/browser/app.js` → `reset()`), which
   silently clamps any out-of-schema-range value back to the old bound and only logs a console
   warning. A slider widened in `index.html` alone will look wider but snap back the instant the
   user drags past the schema's real limit.
3. If the schema key currently has no `min`/`max` at all and you're adding one, note that
   headless/experiment code paths call `resolveParams` with `strict`/no `clampRanges`, so an
   out-of-range value there *throws* instead of clamping — check `src/scenarios/*.js` and
   `configs/*.json` for values that would now be rejected before tightening a bound.

## Adding a parameter to the control panel

1. Make sure it's in `PARAM_SCHEMA` first (add it there with a `doc` and a `group` if not —
   headless runs and the browser both resolve against this schema, so a UI-only param would be
   invisible to experiments).
2. Add a `<div class="param-row">` in the matching `<div class="parameter-section">` in
   `index.html`, copying a neighboring row's structure: a `<span class="param-label">`, the
   `<input>` with `id="<schemaKey>"`, and for a range input, an `oninput` that writes the
   formatted value into a sibling `<span class="param-val" id="<schemaKey>_val">`.
3. Tag it: if only some mechanic variants read it, give its schema entry a `usedBy` (below).
   Untagged means "always shown".
4. Nothing else needs touching — `initParamInputs()`, `readParameterInputs()`, and
   `writeParameterInputs()` all key off `id` generically, and the panel's show/hide logic
   (`src/browser/parampanel.js`) keys off the schema.

## Removing a parameter from the control panel

- Delete its `param-row` `<div>` from `index.html`. The kernel keeps using the schema default;
  no other file references a control by id, so nothing else breaks.
- Don't delete the key from `PARAM_SCHEMA` unless the user also wants it gone from headless
  runs — check `src/scenarios/*.js` and `configs/*.json` for references first, since those load
  the same schema.

## Mechanics dropdowns are the one exception to "id does everything"

Each `<select id="mechanic_<name>">`'s `<option>` list is **hand-written** in `index.html`, not
generated from `MECHANICS_REGISTRY`. So:
- Adding a new **variant** to an existing family (e.g. a new valuation rule) needs a new export
  in that family's module (e.g. `src/mechanics/valuation.js`) *and* a new `<option>` in its
  `<select>` in `index.html` — the dropdown won't pick it up on its own.
- Adding a whole new mechanic **category** needs an entry in `MECHANICS_REGISTRY`
  (`src/mechanics/registry.js`), a default in `DEFAULT_MECHANICS`, and a new
  `<select id="mechanic_<name>">` block in the Mechanics panel — plus a `FAMILY_REQUIRES`
  entry if it is only reached through some variants of another family.

`test/relevance.test.js` checks the option lists against the registry, so a forgotten
`<option>` fails the suite.

## Mechanic relevance (`usedBy`) — keep it in step with every mechanic change

The panel shows a parameter only if a selected mechanic uses it, and re-shapes the moment a
mechanic selector changes (it sets up the *next* run, so it doesn't wait for Reset). The rule
lives in one place, `src/mechanics/relevance.js`; the data lives on the schema entries:

- No `usedBy`: read on every path, always shown.
- `usedBy: []` (`UNREAD`): declared for config compatibility but read by nothing — hidden.
- `usedBy: [clause, ...]`: shown when ANY clause holds. A clause like
  `{matching: ['distanceFriction']}` holds when that family is active AND set to a listed
  variant. Name only the family whose code reads the parameter; gating by a parent family
  (matching exists only under posted trades) comes from `FAMILY_REQUIRES` automatically.
  Shared clauses (`POSTED`, `PAIRWISE`, `REPRODUCING`, `WAVY_TERRAIN`) sit at the top of params.js.

**When adding a variant**, grep its code for every `params.<key>` it reads and add the
variant's name to each of those keys' `usedBy`. Lists are positive, so forgetting hides the
parameter under the new variant — and `test/relevance.test.js` then fails, because it perturbs
every hidden parameter under every variant (from two bases: the defaults, and the selection
hiding the most) and requires the trajectory to stay identical. It also fails if a tag shows a
parameter that never changes a run; a parameter that is real but slow to act goes in the
test's `EXHIBIT` map with the run that shows it.

Relevance is by mechanics only. A parameter that matters only given another parameter's
value (e.g. `inventorPerpetualRoyalty` needs `surplusToTradeFraction > 0`) stays shown.
