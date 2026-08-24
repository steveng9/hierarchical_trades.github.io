/**
 * Emergence of money (RESEARCH.md Group 5) — measurement only, no new mechanics.
 *
 * Menger's question: does one resource become the general intermediary? Measured as each
 * resource's share of active trades and of moved volume, plus its betweenness in the
 * resource-exchange graph.
 *
 * ## Known limitation
 *
 * `numResources` is capped at 3 by the terrain generators and the RGB rendering path. On
 * three nodes, betweenness is nearly degenerate — there is only one possible intermediary
 * per pair — so `betweenness` is not yet a meaningful test of the Mengerian hypothesis.
 * Share-of-trades and share-of-volume remain informative. Lifting the cap (generalising the
 * terrain generators past `new Array(3)` and decoupling rendering from RGB) is a
 * prerequisite for taking this result seriously.
 */
import {Probe} from './probe.js';

export class MoneyProbe extends Probe {
    static probeName = 'money';

    sample(sim) {
        const params = sim.params;
        const trades = sim.world.trademanager.trades;
        const n = params.numResources;
        const row = {tick: sim.tick, resourceCount: n};

        const tradeCount = Array(n).fill(0);
        const volume = Array(n).fill(0);
        // Adjacency weighted by volume, for the betweenness calculation.
        const adjacency = Array.from({length: n}, () => Array(n).fill(0));

        for (const t of trades) {
            const a = t.resourcesIn.A;
            const b = t.resourcesIn.B;
            if (a < n) { tradeCount[a]++; volume[a] += t.volumeMoved.A; }
            if (b < n) { tradeCount[b]++; volume[b] += t.volumeMoved.B; }
            if (a < n && b < n) {
                adjacency[a][b] += t.totalVolume;
                adjacency[b][a] += t.totalVolume;
            }
        }

        const totalTradeSlots = tradeCount.reduce((x, y) => x + y, 0);
        const totalVolume = volume.reduce((x, y) => x + y, 0);

        for (let r = 0; r < n; r++) {
            row[`r${r}_tradeShare`] = totalTradeSlots > 0 ? tradeCount[r] / totalTradeSlots : 0;
            row[`r${r}_volumeShare`] = totalVolume > 0 ? volume[r] / totalVolume : 0;
            // Fraction of other-resource pairs this resource could intermediate between.
            let between = 0;
            let possible = 0;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    if (i === r || j === r) continue;
                    possible++;
                    if (adjacency[i][r] > 0 && adjacency[r][j] > 0) between++;
                }
            }
            row[`r${r}_betweenness`] = possible > 0 ? between / possible : 0;
        }

        // Concentration of volume across resources: 0 = perfectly even, →1 = one dominates.
        const shares = Array.from({length: n}, (_, r) => row[`r${r}_volumeShare`]);
        row.volumeHHI = shares.reduce((a, s) => a + s * s, 0);
        row.dominantResource = shares.indexOf(Math.max(...shares));

        return row;
    }

    summary(sim) {
        const final = this.sample(sim);
        return {
            finalDominantResource: final.dominantResource,
            finalVolumeHHI: final.volumeHHI,
            moneyMetricsMeaningful: sim.params.numResources > 3 ? 1 : 0,
        };
    }
}
