/**
 * Probe interface.
 *
 * A probe is the only place measurement lives. The kernel emits a fixed event vocabulary
 * and knows nothing about metrics; each research group composes the probes it needs. Adding
 * a metric must never mean editing `human.js`.
 *
 * Three hooks, all optional:
 *
 *   attach(sim, emit)  subscribe to events. `emit(stream, row)` appends a row to a named
 *                      event stream (one JSONL file per stream).
 *   sample(sim)        called every `samplePeriod` ticks; return a flat object of numeric
 *                      metrics, or null to skip. Rows land in the timeseries table.
 *   summary(sim)       called once at the end; return flat aggregate metrics. These land in
 *                      the run record and are what sweeps compare across cells.
 *
 * Rows must be flat and JSON-primitive-valued — the SQLite store maps keys to columns.
 */
export class Probe {
    /** Stable identifier. Prefixes this probe's metric columns to avoid collisions. */
    static probeName = 'probe';

    get name() {
        return this.constructor.probeName;
    }

    attach(_sim, _emit) {}
    sample(_sim) { return null; }
    summary(_sim) { return {}; }
}

/** Prefix every key with `${name}.` so probes cannot collide in a shared row. */
export function namespaced(name, row) {
    if (!row) return null;
    const out = {};
    for (const [k, v] of Object.entries(row)) out[`${name}.${k}`] = v;
    return out;
}
