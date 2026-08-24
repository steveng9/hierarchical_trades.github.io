# Attic

Pre-refactor artifacts. Nothing here is imported by the live simulation, and none of it has
been ported to the `src/` module tree or covered by tests.

Kept rather than deleted because several are relevant to planned work:

| File | Why it is here |
|---|---|
| `gene.js` | An earlier genome representation. Directly relevant to RESEARCH.md Group 6 (explicit genes for social reach and productivity). Port it rather than rewriting from scratch. |
| `locality.js` | An earlier spatial-neighbourhood implementation. Relevant to Group 3, and to the spatial-index optimisation noted in the README (`humansWithinReach` is the hot path). |
| `graphs.js`, `graphs.html` | A standalone plotting page superseded by `src/render/statspanel.js`. |
| `histogram.js`, `variablehistogramviewer.js` | Histogram panels not wired into the current UI. |
| `assetmanager.js` | Image preloading. The simulation draws no sprites. |

To bring one back: port it to ES module form, place it under the appropriate `src/`
directory, and add a test.
