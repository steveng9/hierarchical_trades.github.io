/**
 * Terrain generators — how resources are laid out across the world.
 *
 * Registered by name so a scenario can select one without touching the kernel. This is the
 * primary experimental axis for Group 3 (economic geography): the hypothesis there is that
 * institutions nucleate on the *boundaries* between resource regions, where valuation
 * dispersion (and therefore trade surplus) is highest. Testing it means swapping layouts.
 *
 * A generator has the signature:
 *     (ctx) => number[][][]     // [row][col][resourceIndex] concentration in [0, 1]
 * where ctx = {rows, cols, params, rng}.
 *
 * Generators must draw only from `ctx.rng` — never `Math.random()`.
 */
import {average} from '../core/mathutil.js';

/**
 * Smooth interference of four sine waves at irrational frequency ratios, thresholded by
 * `undulation_cutuff`. Produces soft overlapping regional specialisations.
 *
 * This is the historical default and the baseline for every result generated so far.
 */
function wavyNoise(x, y, seed, roughness) {
    x *= roughness;
    y *= roughness;
    // Rotate slightly so the wave crests do not align with the cell grid.
    const angle = 0.36;
    const xr = x * Math.cos(angle) - y * Math.sin(angle);
    const yr = x * Math.sin(angle) + y * Math.cos(angle);

    let v = 0;
    v += Math.sin(xr * 0.013 + seed) * 0.7;
    v += Math.sin(yr * 0.021 + seed * 1.3) * 0.5;
    v += Math.sin((xr + yr) * 0.017 + seed * 2.1) * 0.3;
    v += Math.sin((xr - yr) * 0.011 + seed * 3.7) * 0.2;

    return (v + 1.7) / 3.4;   // normalise to ~[0, 1]
}

/** Mean of the noise field sampled at every pixel inside one cell. */
function cellConcentration(j, i, seed, params) {
    const samples = [];
    for (let y = i * params.cellSize; y < (i + 1) * params.cellSize; y++) {
        for (let x = j * params.cellSize; x < (j + 1) * params.cellSize; x++) {
            samples.push(wavyNoise(x, y, seed, params.roughness));
        }
    }
    return average(samples);
}

export const TERRAIN_GENERATORS = {
    /** Historical default. Smooth, overlapping regions with soft boundaries. */
    wavy({rows, cols, params, rng}) {
        // Seeds are drawn first, one per resource, matching the original construction order.
        const seeds = Array.from({length: params.numResources}, () => rng.next() * 40);
        const cutoff = params.undulation_cutuff;
        const grid = [];
        for (let i = 0; i < rows; i++) {
            grid[i] = [];
            for (let j = 0; j < cols; j++) {
                const cell = new Array(params.numResources).fill(0);
                for (let r = 0; r < params.numResources; r++) {
                    cell[r] = Math.max(cellConcentration(j, i, seeds[r], params) - cutoff, 0) / (1 - cutoff);
                }
                grid[i][j] = cell;
            }
        }
        return grid;
    },

    /** Every cell is pure in one uniformly-chosen resource. Maximal patchiness, no gradient. */
    randomResource({rows, cols, params, rng}) {
        const grid = [];
        for (let i = 0; i < rows; i++) {
            grid[i] = [];
            for (let j = 0; j < cols; j++) {
                const cell = new Array(params.numResources).fill(0);
                cell[rng.int(params.numResources)] = 1;
                grid[i][j] = cell;
            }
        }
        return grid;
    },

    /** Vertical bands, two cells wide, cycling through resources. Maximal boundary length. */
    stripes({rows, cols, params}) {
        const grid = [];
        for (let i = 0; i < rows; i++) {
            grid[i] = [];
            for (let j = 0; j < cols; j++) {
                const cell = new Array(params.numResources).fill(0);
                cell[Math.floor(j / 2) % params.numResources] = 1;
                grid[i][j] = cell;
            }
        }
        return grid;
    },

    /**
     * One pure resource per region, arranged as vertical slabs. Minimal boundary length for
     * a given number of resources — the control against `stripes` for the boundary
     * hypothesis: same specialisation, far less contact area.
     */
    slabs({rows, cols, params}) {
        const grid = [];
        for (let i = 0; i < rows; i++) {
            grid[i] = [];
            for (let j = 0; j < cols; j++) {
                const cell = new Array(params.numResources).fill(0);
                cell[Math.min(params.numResources - 1, Math.floor((j / cols) * params.numResources))] = 1;
                grid[i][j] = cell;
            }
        }
        return grid;
    },

    /**
     * `numVillages` contiguous vertical regions, each carrying an equal-sized group of
     * resources at full concentration. Pairs with the `villages` population placement: with
     * `numVillages = 2` and `numResources = 2n`, resources `[0, n)` cluster on the left and
     * `[n, 2n)` on the right, so each founding community starts with access to only its own
     * local half of the diet — the setup for the half-diet/hub investigation
     * (RESEARCH.md Group 3).
     */
    regionalGroups({rows, cols, params}) {
        const v = params.numVillages;
        const perVillage = Math.ceil(params.numResources / v);
        const grid = [];
        for (let i = 0; i < rows; i++) {
            grid[i] = [];
            for (let j = 0; j < cols; j++) {
                const cell = new Array(params.numResources).fill(0);
                const village = Math.min(v - 1, Math.floor((j / cols) * v));
                const start = village * perVillage;
                const end = Math.min(params.numResources, start + perVillage);
                for (let r = start; r < end; r++) cell[r] = 1;
                grid[i][j] = cell;
            }
        }
        return grid;
    },

    /** Uniform mixture everywhere. No specialisation, so no gains from trade: a null model. */
    uniform({rows, cols, params}) {
        const grid = [];
        for (let i = 0; i < rows; i++) {
            grid[i] = [];
            for (let j = 0; j < cols; j++) {
                const cell = new Array(params.numResources).fill(0);
                for (let r = 0; r < params.numResources; r++) cell[r] = 1;
                grid[i][j] = cell;
            }
        }
        return grid;
    },
};

export function getTerrainGenerator(name) {
    const gen = TERRAIN_GENERATORS[name];
    if (!gen) {
        throw new Error(`Unknown terrain generator "${name}". Available: ${Object.keys(TERRAIN_GENERATORS).join(', ')}`);
    }
    return gen;
}
