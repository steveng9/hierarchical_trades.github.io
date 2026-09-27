/**
 * HistogramPanel: population-distribution heatmaps, updated on the same cadence as
 * StatsPanel's graphs and positioned directly below them.
 *
 * Two kinds of column:
 *   - trait histograms (reach, productivity) bin the LIVING population;
 *   - lifetime histograms (age, offspring) bin the most recent deaths only. Binning the
 *     living would plot each cohort's age as a rising diagonal; binning completed lives
 *     shows the distribution of total lifespan and lifetime fertility directly. Each column
 *     covers the last DEATH_WINDOW deaths so one death per tick doesn't make it one pixel.
 */
import {PARAMS, gameEngine, isRunning} from '../browser/context.js';
import {Histogram} from './histogram.js';
import {SOCIAL_REACH_SHAPE} from '../core/human.js';
import {EVENTS} from '../core/events.js';

const BINS = 20;
const ROW_H = 130;
/** How many of the most recent deaths each lifetime-histogram column summarises. */
const DEATH_WINDOW = 100;

/** Bin non-negative values into BINS buckets over [0, max]. If `max` is omitted, uses the
 * live max of `values` instead — the scale then tracks whatever's currently in view, which
 * hides a shift in the population's average as just a rescaled axis. Pass a fixed `max` when
 * the point is to see that shift happen. */
function binByRange(values, max) {
    const bins = Array(BINS).fill(0);
    if (max === undefined) {
        if (values.length === 0) return bins;
        max = Math.max(...values) || 1;
    }
    for (const v of values) bins[Math.min(BINS - 1, Math.max(0, Math.floor((v / max) * BINS)))]++;
    return bins;
}

/** Bin non-negative integer counts directly: bucket i is count i, last bucket is "BINS-1 or more". */
function binByCount(values) {
    const bins = Array(BINS).fill(0);
    for (const v of values) bins[Math.min(BINS - 1, Math.max(0, Math.round(v)))]++;
    return bins;
}

export class HistogramPanel {
    /**
     * @param {StatsPanel} statsPanel
     * @param {import('../core/events.js').EventBus} events  the simulation's bus, for deaths
     */
    constructor(statsPanel, events) {
        this.statsPanel = statsPanel;

        // Ring of the most recent completed lives. The panel is rebuilt with each new
        // simulation, and the old bus is discarded with the old simulation, so no unsubscribe.
        this._recentDeaths = [];
        // Age axis ceiling: the longest life seen so far. maxHumanAge can't serve, since it is
        // often effectively infinite (starvation ends lives first), and a ceiling that only
        // grows still lets a real shift in lifespan show as the distribution moving.
        this._longestLife = 1;
        events.on(EVENTS.HUMAN_DIED, ({human}) => {
            this._longestLife = Math.max(this._longestLife, human.age);
            this._recentDeaths.push({age: human.age, offspring: human.numOffspring});
            if (this._recentDeaths.length > DEATH_WINDOW) this._recentDeaths.shift();
        });

        this._d = {
            age:          [],
            offspring:    [],
            socialReach:  [],
            productivity: [],
        };

        // Shares StatsPanel's viewport so panning/zooming any graph or histogram moves them
        // all together.
        const viewport = statsPanel.viewport;
        const GW = 600, GH = 100;
        const mk = (data, label) => new Histogram(0, 0, data, label, GW, GH, BINS, viewport);
        this._histograms = [
            mk(this._d.age,          `Age at death, last ${DEATH_WINDOW} deaths (0 → longest life so far)`),
            mk(this._d.offspring,    `Lifetime offspring, last ${DEATH_WINDOW} deaths (0–19+)`),
            mk(this._d.socialReach,  'Social reach distribution (0 → fixed ceiling)'),
            mk(this._d.productivity, 'Productivity distribution (0 → current max)'),
        ];

        this._lastGen = -1;

        // Whichever child histogram currently owns an in-progress drag.
        this._activeDrag = null;
    }

    // -- pan/zoom input, routed here from the canvas's mouse listeners -----------------

    handleMouseDown(x, y, shiftKey) {
        for (const h of this._histograms) {
            if (h.handleMouseDown(x, y, shiftKey)) {
                this._activeDrag = h;
                return;
            }
        }
    }

    handleMouseMove(x, y) {
        this._activeDrag?.handleMouseMove(x, y);
    }

    handleMouseUp(x, y) {
        this._activeDrag?.handleMouseUp(x, y);
        this._activeDrag = null;
    }

    // Always sits below StatsPanel's graphs.
    get y() {
        return this.statsPanel.y + this.statsPanel.panelHeight + PARAMS.margin;
    }

    get panelHeight() {
        return Math.ceil(this._histograms.length / 2) * ROW_H;
    }

    _collectData() {
        const humans = gameEngine.automata.humans;
        const deaths = this._recentDeaths;
        this._d.age.push(binByRange(deaths.map(d => d.age), this._longestLife));
        this._d.offspring.push(binByCount(deaths.map(d => d.offspring)));
        // Fixed ceiling, not the population's live max: reach is drawn from an
        // Exponential(SOCIAL_REACH_SHAPE) scaled by social_reach_multiplier, and 4/shape
        // covers ~98% of that initial draw (P(X > 4/shape) ≈ e^-4). Freezing the axis here
        // means an evolutionary drift in average reach shows up as the distribution visibly
        // moving, rather than being hidden by an axis that rescales to match it.
        const reachMax = (4 / SOCIAL_REACH_SHAPE) * PARAMS.social_reach_multiplier;
        this._d.socialReach.push(binByRange(humans.map(h => h.socialReach), reachMax));
        this._d.productivity.push(binByRange(humans.map(h => h.productivity)));
    }

    update() {}

    draw(ctx) {
        const gen = gameEngine.automata.generation;
        if (isRunning && gen !== this._lastGen && gen % PARAMS.reportingPeriod === 0) {
            this._lastGen = gen;
            this._collectData();
        }

        const panelY = this.y;
        const col1X  = PARAMS.margin;
        const col2X  = PARAMS.margin + 620;

        for (let i = 0; i < this._histograms.length; i++) {
            const h = this._histograms[i];
            h.x = i % 2 === 0 ? col1X : col2X;
            h.y = panelY + Math.floor(i / 2) * ROW_H;
            h.draw(ctx);
        }
    }
}
