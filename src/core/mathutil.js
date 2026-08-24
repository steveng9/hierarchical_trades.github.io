/**
 * Pure numeric helpers. No randomness (see `rng.js`) and no simulation state, so these
 * are safe to use from core, mechanics, probes, and render alike.
 */

export function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/** Population (not sample) mean and standard deviation. */
export function meanAndStd(arr) {
    const n = arr.length;
    if (n === 0) return {mean: 0, std: 0};
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    return {mean, std: Math.sqrt(variance)};
}

/** Euclidean distance between anything carrying {x, y}. */
export function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
}

/** Gini coefficient of a non-negative distribution. 0 = perfect equality, →1 = maximal. */
export function gini(values) {
    const xs = values.filter(v => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
    const n = xs.length;
    if (n === 0) return 0;
    const total = xs.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    let weighted = 0;
    for (let i = 0; i < n; i++) weighted += (i + 1) * xs[i];
    return (2 * weighted) / (n * total) - (n + 1) / n;
}

/** Shannon entropy (base 2) of a set of counts or weights. */
export function entropy(values) {
    const total = values.reduce((a, b) => a + b, 0);
    if (total <= 0) return 0;
    let h = 0;
    for (const v of values) {
        if (v <= 0) continue;
        const p = v / total;
        h -= p * Math.log2(p);
    }
    return h;
}
