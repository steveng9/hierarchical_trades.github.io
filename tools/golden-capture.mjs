/**
 * Golden-trajectory capture for the PRE-REFACTOR simulation.
 *
 * Loads the original flat browser scripts inside a `vm` context with a minimal DOM shim,
 * replaces `Math.random` with a seeded stream, runs N ticks, and writes a per-tick state
 * hash. The refactored kernel must reproduce this file byte-for-byte.
 *
 * This tool exists only as provenance for how the baseline was established. The flat scripts
 * it loads were deleted when `src/` became authoritative, so it CANNOT run against the
 * current working tree. To re-run it, check out the pre-refactor commit into a worktree and
 * point `--src` at it:
 *
 *     git worktree add /tmp/pre-refactor 07fa153
 *     node tools/golden-capture.mjs --src /tmp/pre-refactor --ticks 200
 *
 * The goldens it produced live in test/fixtures/ and are asserted by test/golden.test.js.
 *
 * Usage: node tools/golden-capture.mjs [--seed N] [--ticks N] [--out PATH] [--src DIR]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {parseArgs} from 'node:util';
import {Random} from '../src/core/rng.js';

const {values} = parseArgs({
    options: {
        seed:  {type: 'string', default: '12345'},
        ticks: {type: 'string', default: '400'},
        out:   {type: 'string', default: 'test/fixtures/golden-trajectory.json'},
        src:   {type: 'string', default: '.'},
    },
});

const SEED  = Number(values.seed);
const TICKS = Number(values.ticks);

// Load order mirrors index.html, minus main.js (which touches the canvas on load).
const LOAD_ORDER = [
    'assetmanager.js', 'histogram.js', 'graph.js', 'variablehistogramviewer.js',
    'variableviewer.js', 'humandataview.js', 'gameengine.js', 'util.js', 'params.js',
    'gene.js', 'automata.js', 'human.js', 'trade.js', 'trademanager.js', 'forest.js',
    'tradeflowview.js', 'statspanel.js', 'datamanager.js', 'selectionmanager.js',
    'selectionview.js', 'tradeview.js',
];

/** Canvas/DOM surface wide enough for the scripts to load and construct without drawing. */
function makeDomShim() {
    const noop = () => {};
    const ctx2d = new Proxy({}, {
        get: (_, prop) => (prop === 'canvas' ? {width: 1240, height: 2600} : noop),
    });
    const element = {
        getContext: () => ctx2d,
        width: 1240, height: 2600,
        classList: {add: noop, remove: noop},
        addEventListener: noop,
        style: {},
        textContent: '',
        querySelectorAll: () => [],
    };
    return {
        window: {requestAnimationFrame: noop, setTimeout: noop, io: undefined},
        document: {
            getElementById: () => element,
            querySelectorAll: () => [],
            createElement: () => element,
            addEventListener: noop,
        },
    };
}

function buildContext() {
    const {window, document} = makeDomShim();
    const sandbox = {
        window, document,
        performance: {now: () => 0},   // frozen clock: wall time must not affect dynamics
        console: {log: () => {}, warn: () => {}, error: (...a) => console.error(...a)},
        Math, JSON, Array, Object, Number, String, Map, Set, Error, Infinity, NaN,
        isNaN, parseFloat, parseInt, Date,
    };
    sandbox.globalThis = sandbox;
    sandbox.window.document = document;
    const context = vm.createContext(sandbox);

    for (const file of LOAD_ORDER) {
        const full = path.resolve(values.src, file);
        vm.runInContext(fs.readFileSync(full, 'utf8'), context, {filename: file});
    }
    return context;
}

/**
 * Canonical world serialisation. Numbers use default JS formatting, which round-trips
 * exactly, so the hash is sensitive to any bit-level divergence.
 */
function hashWorld(context) {
    const automata = context.gameEngine.automata;
    const parts = [`g:${automata.generation}`];

    for (const h of automata.humans) {
        parts.push(`H${h.id}|${h.x}|${h.y}|${h.supply.join(',')}|${h.metabolism.join(',')}|${h.alternativeSupply.join(',')}|${h.age}|${h.socialReach}|${h.productivity}`);
    }
    for (const t of automata.trademanager.trades) {
        parts.push(`T${t.id}|${t.level}|${t.deprecated ? 1 : 0}|${t.supply.join(',')}|${t.escrow.join(',')}|${t.invocations.A},${t.invocations.B}|${t.volumeMoved.A},${t.volumeMoved.B}|${t.managers.size}`);
    }

    // FNV-1a 64-bit (split into two 32-bit halves; BigInt kept out of the hot path).
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const s = parts.join(';');
    for (let i = 0; i < s.length; i++) {
        h1 ^= s.charCodeAt(i);
        h1 = Math.imul(h1, 0x01000193);
        h2 = Math.imul(h2 ^ s.charCodeAt(i), 0x85ebca6b);
    }
    return ((h1 >>> 0).toString(16).padStart(8, '0')) + ((h2 >>> 0).toString(16).padStart(8, '0'));
}

function main() {
    const context = buildContext();
    const rng = new Random(SEED);

    // Seed the stream BEFORE any world construction, so forest and agent init are captured.
    context.Math.random = () => rng.next();

    vm.runInContext('gameEngine = new GameEngine();', context);
    vm.runInContext('new Automata();', context);

    const hashes = [];
    for (let tick = 0; tick < TICKS; tick++) {
        vm.runInContext('gameEngine.automata.update();', context);
        hashes.push(hashWorld(context));
    }

    const automata = context.gameEngine.automata;
    const trades = automata.trademanager.trades;
    const record = {
        note: 'Baseline captured from the pre-refactor flat scripts. src/ must reproduce this exactly.',
        capturedAt: new Date().toISOString(),
        seed: SEED,
        ticks: TICKS,
        rngDraws: rng.drawCount,
        finalPopulation: automata.humans.length,
        finalActiveTrades: trades.length,
        totalTradesBuilt: automata.trademanager.total_trades_made,
        tradesByLevel: automata.trademanager.totalTradesByLevel,
        maxLevelReached: trades.reduce((m, t) => Math.max(m, t.level), 0),
        hashes,
    };

    fs.mkdirSync(path.dirname(values.out), {recursive: true});
    fs.writeFileSync(values.out, JSON.stringify(record, null, 2));

    console.log(`seed=${SEED} ticks=${TICKS}`);
    console.log(`population=${record.finalPopulation} activeTrades=${record.finalActiveTrades} built=${record.totalTradesBuilt}`);
    console.log(`byLevel=${JSON.stringify(record.tradesByLevel)} maxLevel=${record.maxLevelReached}`);
    console.log(`rngDraws=${record.rngDraws}`);
    console.log(`final hash=${hashes[hashes.length - 1]}`);
    console.log(`wrote ${values.out}`);
}

main();
