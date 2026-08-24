/**
 * Append-only JSONL streams for high-volume per-run output.
 *
 * Per-tick timeseries and per-trade event rows are far too voluminous for the run database
 * — a single sweep cell can produce millions of rows — so they land in newline-delimited
 * JSON, one file per stream per run. Both pandas (`read_json(lines=True)`) and `jq` read
 * them directly, and an interrupted run leaves a valid prefix rather than a corrupt file.
 */
import fs from 'node:fs';
import path from 'node:path';

export class JsonlWriter {
    /** @param {string} dir  directory to hold this run's streams */
    constructor(dir) {
        this.dir = dir;
        fs.mkdirSync(dir, {recursive: true});
        this.handles = new Map();
        this.counts = new Map();
    }

    /** Append one row to a named stream. Streams are created on first write. */
    write(stream, row) {
        let fd = this.handles.get(stream);
        if (fd === undefined) {
            fd = fs.openSync(path.join(this.dir, `${stream}.jsonl`), 'a');
            this.handles.set(stream, fd);
            this.counts.set(stream, 0);
        }
        fs.writeSync(fd, JSON.stringify(row) + '\n');
        this.counts.set(stream, this.counts.get(stream) + 1);
    }

    /** Rows written per stream. */
    stats() {
        return Object.fromEntries(this.counts);
    }

    close() {
        for (const fd of this.handles.values()) fs.closeSync(fd);
        this.handles.clear();
    }
}
