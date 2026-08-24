/**
 * Canonical world hashing, for determinism and regression assertions.
 *
 * Numbers are serialised with default JS formatting, which round-trips exactly, so the
 * digest is sensitive to any bit-level divergence — a refactor that shifts one floating-
 * point operation will change the hash.
 *
 * The field list is deliberately frozen: it defines what "the same trajectory" means. Adding
 * a field invalidates every stored golden, so extend only alongside a recapture.
 */

/**
 * @param {number} tick
 * @param {Array} humans
 * @param {Array} trades   active trades only
 * @returns {string} 16-character hex digest
 */
export function hashWorldState(tick, humans, trades) {
    const parts = [`g:${tick}`];

    for (const h of humans) {
        parts.push(
            `H${h.id}|${h.x}|${h.y}|${h.supply.join(',')}|${h.metabolism.join(',')}` +
            `|${h.alternativeSupply.join(',')}|${h.age}|${h.socialReach}|${h.productivity}`
        );
    }
    for (const t of trades) {
        parts.push(
            `T${t.id}|${t.level}|${t.deprecated ? 1 : 0}|${t.supply.join(',')}|${t.escrow.join(',')}` +
            `|${t.invocations.A},${t.invocations.B}|${t.volumeMoved.A},${t.volumeMoved.B}|${t.managers.size}`
        );
    }

    // FNV-1a, two independent 32-bit lanes concatenated. BigInt is avoided in this path
    // because it is called once per tick across long sweeps.
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const s = parts.join(';');
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 ^= c;
        h1 = Math.imul(h1, 0x01000193);
        h2 = Math.imul(h2 ^ c, 0x85ebca6b);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
