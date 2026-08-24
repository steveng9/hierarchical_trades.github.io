/**
 * Pricing: how a would-be inventor sets the exchange rate for a new trade.
 *
 * Shared by level-1 and hierarchical construction — the inductive property of the model
 * depends on both using the same rule, so it lives in one place.
 *
 * The rate is centred on the mean valuation ratio among neighbours and spread by their
 * dispersion. That is Ostrom's second design principle (congruence with local conditions)
 * falling out of the mechanics rather than being imposed: prices are fitted to the
 * neighbourhood that will use them.
 *
 * Interface: quote({ratios, params}) -> {mean, spread, in1, out1, in2, out2} | null
 */
import {meanAndStd} from '../core/mathutil.js';

export const PRICING = {
    /**
     * Historical default. Spread is `surplus_multiplier` x the dispersion of local valuation
     * ratios, clamped to half the mean (so `out2` stays positive) and floored microscopically
     * above zero (so a perfectly homogeneous neighbourhood still yields a well-formed trade
     * rather than a degenerate zero-width one).
     */
    dispersionSpread: {
        quote({ratios, params}) {
            const {mean, std} = meanAndStd(ratios);
            const spread = Math.max(Math.min(std * params.surplus_multiplier, mean / 2), 0.000001);
            return {
                mean,
                spread,
                in1: 1,
                out1: 1,
                in2: mean + spread,
                out2: mean - spread,
            };
        },
    },

    /**
     * Fixed proportional margin, ignoring dispersion.
     *
     * A control for Group 1: it decouples the inventor's take from local heterogeneity, so
     * rent no longer tracks how much genuine coordination value the trade supplies. If
     * hierarchy still forms under a fixed margin, the driver is rent as such rather than
     * gains from trade.
     */
    fixedMargin: {
        quote({ratios, params}) {
            const {mean} = meanAndStd(ratios);
            const spread = Math.max(mean * params.surplus_multiplier * 0.5, 0.000001);
            return {
                mean,
                spread: Math.min(spread, mean / 2),
                in1: 1,
                out1: 1,
                in2: mean + Math.min(spread, mean / 2),
                out2: mean - Math.min(spread, mean / 2),
            };
        },
    },
};
