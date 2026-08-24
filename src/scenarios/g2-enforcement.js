/**
 * Group 2 — Enforcement, defection, and Ostrom's design principles.
 *
 * Status: BLOCKED. Needs one mechanic that does not exist yet.
 *
 * The sim currently instantiates Ostrom principles 1 (clear boundaries — `isWithinReach`),
 * 2 (congruence with local conditions — prices fitted to local valuation dispersion), and 8
 * (nested enterprises — the hierarchy itself). Principles 3, 4, and 5 are all unreachable
 * for the same single reason: **a norm cannot currently be violated**. Every agent obeys the
 * posted rate mechanically, so there is nothing to monitor and nothing to sanction.
 *
 * ## The unlock
 *
 * One mechanic, roughly 60 lines: agents invoke a trade without surrendering the spread with
 * probability `defection_rate`; a manager within reach of a defector detects and delists
 * them. The elegance is that the manager's reach then serves as both the distribution radius
 * and the monitoring radius — hierarchy becomes a distribution network and an enforcement
 * network at once, which is exactly the "institutions are norms about enforcement of norms"
 * intuition, with no bolt-on machinery.
 *
 * ## To implement
 *
 * 1. `src/mechanics/compliance.js` — variants `alwaysComply` (default, current behaviour)
 *    and `probabilisticDefection`.
 * 2. Call site in `Trade.invokeLevel1` / `invokeHierarchical`, around `distributeSurplus`.
 * 3. `src/mechanics/enforcement.js` — `none` (default) and `managerDelisting`.
 * 4. `src/probes/compliance.js` — defection rate, detection rate, delisting counts,
 *    surplus lost to defection.
 * 5. Params: `defection_rate`, `detection_probability`, `sanction_duration`.
 *
 * Once those exist, delete `blocked` below and this scenario runs.
 */
export const enforcement = {
    name: 'g2-enforcement',
    group: 2,
    description: 'Defection, monitoring, and graduated sanctions. Ostrom principles 3-5.',
    blocked: 'Requires the compliance/enforcement mechanics — see the header of this file.',
    params: {},
    mechanics: {},
    probes: ['core', 'hierarchy', 'value'],
    ticks: 3000,
    samplePeriod: 10,
};
