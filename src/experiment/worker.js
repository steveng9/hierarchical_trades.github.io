/**
 * Worker thread entry point — runs a single sweep cell.
 *
 * Receives its task via workerData, opens its own SQLite connection (WAL mode
 * handles concurrent writers), runs the simulation, and posts the result back.
 */
import {parentPort, workerData} from 'node:worker_threads';
import {runOnce} from './runner.js';
import {RunStore} from './store/sqlite.js';

const {task, dbPath} = workerData;

let store = null;
try {
    store = new RunStore(dbPath);
    const result = runOnce({
        ...task,
        store,
        quiet: task.quiet,
    });
    parentPort.postMessage({
        status: 'done',
        runId: result.runId,
        runStatus: result.status,
        error: result.error ?? null,
        wallMs: result.wallMs,
        summary: result.summary,
    });
} catch (err) {
    parentPort.postMessage({
        status: 'error',
        error: `${err.name}: ${err.message}`,
    });
} finally {
    store?.close();
}
