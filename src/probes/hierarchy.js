/**
 * Structural metrics of the institutional hierarchy.
 *
 * Feeds the phase diagram (Thesis B: depth as an environmental readout) and the
 * concentration measures that say whether one institution dominates the economy.
 */
import {Probe} from './probe.js';
import {entropy} from '../core/mathutil.js';

export class HierarchyProbe extends Probe {
    static probeName = 'hierarchy';

    sample(sim) {
        const trades = sim.world.trademanager.trades;
        const row = {tick: sim.tick, maxDepth: 0, treeCount: 0, meanBranching: 0, fracVolumeL2plus: 0};
        if (trades.length === 0) return row;

        const roots = trades.filter(t => !t.isHierarchical);
        const withChildren = trades.filter(t => t.childTrades.some(c => !c.deprecated));

        let totalVolume = 0;
        let volumeL2plus = 0;
        let totalManagers = 0;
        const treeSizes = [];

        for (const t of trades) {
            totalVolume += t.totalVolume;
            if (t.level >= 2) volumeL2plus += t.totalVolume;
            totalManagers += t.managers.size;
            row.maxDepth = Math.max(row.maxDepth, t.level);
        }

        // Size of each institution: a root plus every live descendant.
        for (const root of roots) {
            let size = 0;
            const stack = [root];
            while (stack.length) {
                const node = stack.pop();
                if (node.deprecated) continue;
                size++;
                for (const child of node.childTrades) stack.push(child);
            }
            treeSizes.push(size);
        }

        row.treeCount = roots.length;
        row.meanBranching = withChildren.length
            ? withChildren.reduce((a, t) => a + t.childTrades.filter(c => !c.deprecated).length, 0) / withChildren.length
            : 0;
        row.fracVolumeL2plus = totalVolume > 0 ? volumeL2plus / totalVolume : 0;
        row.totalManagers = totalManagers;
        row.meanManagersPerTrade = totalManagers / trades.length;
        row.largestTreeSize = treeSizes.length ? Math.max(...treeSizes) : 0;
        row.meanTreeSize = treeSizes.length ? treeSizes.reduce((a, b) => a + b, 0) / treeSizes.length : 0;

        // Concentration: low entropy over tree sizes means one institution dominates.
        row.treeSizeEntropy = entropy(treeSizes);
        row.fracInLargestTree = treeSizes.length
            ? Math.max(...treeSizes) / treeSizes.reduce((a, b) => a + b, 0)
            : 0;

        return row;
    }

    summary(sim) {
        const final = this.sample(sim);
        return {
            finalMaxDepth: final.maxDepth,
            finalTreeCount: final.treeCount,
            finalMeanBranching: final.meanBranching,
            finalFracVolumeL2plus: final.fracVolumeL2plus,
            finalLargestTreeSize: final.largestTreeSize,
            finalFracInLargestTree: final.fracInLargestTree,
            finalMeanManagersPerTrade: final.meanManagersPerTrade ?? 0,
        };
    }
}
