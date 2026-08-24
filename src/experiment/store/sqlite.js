/**
 * Run database.
 *
 * Holds what you need to *find and compare* runs — configuration, provenance, status, and
 * scalar summary metrics — while the bulk per-tick output stays in JSONL beside it. That
 * split keeps the database small enough to query interactively across a whole sweep.
 *
 * Uses the built-in `node:sqlite`, so there is no dependency and nothing to compile.
 *
 * Summary metrics are stored long-format in `run_metrics(run_id, key, value)` rather than as
 * columns, because each probe contributes its own keys and adding a probe must not require
 * a schema migration. Pivot at query time:
 *
 *   SELECT r.seed, r.params_json ->> '$.maxTradeLevel' AS max_level,
 *          MAX(CASE WHEN m.key='core.maxLevelReached' THEN m.value END) AS depth
 *   FROM runs r JOIN run_metrics m USING(run_id)
 *   WHERE r.experiment = 'does-hierarchy-pay' AND r.status = 'ok'
 *   GROUP BY r.run_id;
 */
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
    run_id             TEXT PRIMARY KEY,
    experiment         TEXT NOT NULL,
    scenario           TEXT NOT NULL,
    seed               INTEGER NOT NULL,
    ticks              INTEGER NOT NULL,
    params_json        TEXT NOT NULL,
    mechanics_json     TEXT NOT NULL,
    params_fingerprint TEXT NOT NULL,
    probes             TEXT NOT NULL,
    git_sha            TEXT,
    code_dirty         INTEGER,
    started_at         TEXT NOT NULL,
    finished_at        TEXT,
    wall_ms            INTEGER,
    status             TEXT NOT NULL,
    error              TEXT,
    final_state_hash   TEXT,
    output_dir         TEXT
);

CREATE TABLE IF NOT EXISTS run_metrics (
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    key    TEXT NOT NULL,
    value  REAL,
    PRIMARY KEY (run_id, key)
);

CREATE INDEX IF NOT EXISTS idx_runs_experiment  ON runs(experiment);
CREATE INDEX IF NOT EXISTS idx_runs_fingerprint ON runs(params_fingerprint);
CREATE INDEX IF NOT EXISTS idx_metrics_key      ON run_metrics(key);
`;

export class RunStore {
    constructor(dbPath) {
        fs.mkdirSync(path.dirname(dbPath), {recursive: true});
        this.db = new DatabaseSync(dbPath);
        // WAL keeps concurrent sweep workers from blocking each other on writes.
        this.db.exec('PRAGMA journal_mode = WAL;');
        this.db.exec(SCHEMA);
        this.path = dbPath;
    }

    openRun(record) {
        this.db.prepare(`
            INSERT INTO runs (run_id, experiment, scenario, seed, ticks, params_json,
                              mechanics_json, params_fingerprint, probes, git_sha, code_dirty,
                              started_at, status, output_dir)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
            record.runId, record.experiment, record.scenario, record.seed, record.ticks,
            JSON.stringify(record.params), JSON.stringify(record.mechanics),
            record.paramsFingerprint, JSON.stringify(record.probes),
            record.gitSha ?? null, record.codeDirty ? 1 : 0,
            record.startedAt, 'running', record.outputDir ?? null
        );
    }

    closeRun(runId, {status, summary = {}, error = null, wallMs = null, finalStateHash = null}) {
        this.db.prepare(`
            UPDATE runs SET finished_at = ?, wall_ms = ?, status = ?, error = ?, final_state_hash = ?
            WHERE run_id = ?
        `).run(new Date().toISOString(), wallMs, status, error, finalStateHash, runId);

        const insert = this.db.prepare(
            'INSERT OR REPLACE INTO run_metrics (run_id, key, value) VALUES (?,?,?)'
        );
        for (const [key, value] of Object.entries(summary)) {
            // Only numeric metrics belong here; strings (hashes, labels) live on `runs`.
            const num = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
            if (Number.isFinite(num)) insert.run(runId, key, num);
        }
    }

    /** Runs matching an experiment, newest first. */
    listRuns(experiment) {
        return this.db.prepare(
            'SELECT * FROM runs WHERE experiment = ? ORDER BY started_at DESC'
        ).all(experiment);
    }

    /** One metric across every run of an experiment — the sweep comparison primitive. */
    metric(experiment, key) {
        return this.db.prepare(`
            SELECT r.run_id, r.seed, r.params_json, m.value
            FROM runs r JOIN run_metrics m USING(run_id)
            WHERE r.experiment = ? AND m.key = ? AND r.status = 'ok'
            ORDER BY r.seed
        `).all(experiment, key);
    }

    /** True if this exact configuration already completed — lets sweeps resume. */
    hasCompleted(experiment, scenario, fingerprint, seed) {
        const row = this.db.prepare(`
            SELECT 1 FROM runs
            WHERE experiment = ? AND scenario = ? AND params_fingerprint = ? AND seed = ? AND status = 'ok'
            LIMIT 1
        `).get(experiment, scenario, fingerprint, seed);
        return row !== undefined;
    }

    close() {
        this.db.close();
    }
}
