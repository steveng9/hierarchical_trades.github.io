# Engineering / UI TODO

Small, concrete build items — not research questions (those live in `RESEARCH.md`).

## Infinite, scrollable world mode

A "Forest" panel option alongside "Wrapped": instead of a fixed-size toroidal map, an
unbounded world the user can pan around by click-drag. Distinct from wrapping — no seam,
the map just keeps generating (or the visible viewport moves independently of the sim's
internal coordinate space). Needs a design pass before implementation: how far does
generated terrain extend ahead of the viewport, does it regenerate deterministically from
seed if you pan back, how does the camera interact with the existing click-drag trade/human
selection on the canvas.

## Long-lived L2+ trade investigation view

A view for digging into individual high-level trades that persist a long time: who invented
it, are they still alive, do the managers of this trade also participate in trades at other
levels, is there evidence of one agent repeatedly exploiting/re-managing the same trade, and
roughly how many agent-generations has the trade survived across. Basically a detail/story
view for one norm-of-norms, analogous to what the trade data view gives for volume/supply but
biographical rather than economic.
