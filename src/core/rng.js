/**
 * Deterministic pseudo-random number generation.
 *
 * The simulation must be bit-for-bit reproducible from a single integer seed, so
 * `Math.random()` is never called anywhere in `src/core`, `src/mechanics`, or
 * `src/probes`. Every stochastic call site draws from an injected `Random`.
 *
 * Algorithm: sfc32 (Small Fast Counting, 128-bit state), seeded by expanding one
 * integer through splitmix32. Chosen over the more common mulberry32 because a long
 * sweep can plausibly issue >2^32 draws (500 agents x ~10 draws/tick x 100k ticks is
 * ~5e8, the same order as mulberry32's period), and a wrapped generator would silently
 * correlate. sfc32 has a guaranteed minimum period of 2^32 per stream with an average
 * period near 2^127, and passes PractRand.
 *
 * ## Named substreams
 *
 * `fork(label)` derives an independent generator whose seed is a hash of the parent
 * seed and the label. This matters for experiment comparability: if agent
 * initialisation and forest generation share one stream, adding a single draw to the
 * forest shifts every subsequent agent draw, and two runs that should differ in one
 * parameter instead differ in everything. Give each subsystem its own substream and
 * that coupling disappears.
 */

/** FNV-1a, 32-bit. Hashes a substream label into seed material. */
function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** splitmix32 — expands one integer into a well-distributed stream of seed words. */
function splitmix32(seed) {
    let a = seed >>> 0;
    return function next() {
        a = (a + 0x9e3779b9) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0);
    };
}

export class Random {
    /**
     * @param {number|string} seed  Integer seed, or a string that is hashed to one.
     */
    constructor(seed = 0) {
        this.seed = seed;
        const seedInt = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
        const gen = splitmix32(seedInt);
        this._a = gen();
        this._b = gen();
        this._c = gen();
        this._d = gen();
        this._count = 0;
    }

    /** Uniform in [0, 1). The single primitive every other method is built from. */
    next() {
        this._count++;
        // sfc32
        const t = (((this._a + this._b) >>> 0) + this._d) >>> 0;
        this._d = (this._d + 1) >>> 0;
        this._a = this._b ^ (this._b >>> 9);
        this._b = (this._c + (this._c << 3)) >>> 0;
        this._c = ((this._c << 21) | (this._c >>> 11)) >>> 0;
        this._c = (this._c + t) >>> 0;
        return t / 4294967296;
    }

    /** Uniform integer in [0, n). */
    int(n) {
        return Math.floor(this.next() * n);
    }

    /** Uniform float in [min, max). */
    float(min, max) {
        return this.next() * (max - min) + min;
    }

    /** Boolean true with probability p. */
    chance(p) {
        return this.next() < p;
    }

    /**
     * Gaussian sample via Box-Muller.
     *
     * Deliberately discards the second variate (z1) rather than caching it, matching the
     * pre-refactor `generateNormalSample`. Caching would halve the draws but shift the
     * stream, and fidelity to the original dynamics is worth more than the saved draws.
     */
    normal(mean = 0, stdDev = 1) {
        const u1 = this.next();
        const u2 = this.next();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdDev + mean;
    }

    /** Exponential sample: a right-skewed positive value with rate `lambda`. */
    rightSkew(lambda = 1) {
        return -Math.log(1 - this.next()) / lambda;
    }

    /** Fisher-Yates on a copy. Never mutates the input. */
    shuffle(arr) {
        const copy = arr.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    /** Uniformly choose one element. Returns undefined for an empty array. */
    pick(arr) {
        return arr.length === 0 ? undefined : arr[this.int(arr.length)];
    }

    /**
     * An independent generator for one subsystem. Deterministic in (parent seed, label),
     * so `fork('forest')` yields the same stream regardless of what else has drawn.
     */
    fork(label) {
        const seedInt = typeof this.seed === 'string' ? hashString(this.seed) : (this.seed >>> 0);
        return new Random((seedInt ^ hashString(label)) >>> 0);
    }

    /** Snapshot of internal state, for save/restore and determinism assertions. */
    getState() {
        return {a: this._a, b: this._b, c: this._c, d: this._d, count: this._count};
    }

    setState(state) {
        this._a = state.a;
        this._b = state.b;
        this._c = state.c;
        this._d = state.d;
        this._count = state.count;
    }

    /** Total draws issued. Useful for detecting stream divergence between runs. */
    get drawCount() {
        return this._count;
    }
}
