/**
 * Manual spawning: dropping a group of agents into a running world.
 *
 * Each agent enters through `world.addHuman`, the same door a birth uses, so the active
 * exchange mechanic wires it by its own link-formation rule with no spawn-specific code here.
 * Agents are added strictly one at a time, each wired before the next is added, so later
 * members of the group can link to earlier ones and the group integrates with the existing
 * population and with itself alike.
 */
import {placeOnMap} from './mathutil.js';

/**
 * Spread of a dropped group, in px per sqrt(extra agent). The std. deviation of the cluster is
 * `SPAWN_SPREAD * sqrt(count - 1)`: area, and so agent density, stays roughly constant as the
 * count grows, and a single agent lands exactly on the cursor (spread 0).
 */
export const SPAWN_SPREAD = 4;

/**
 * Drop `count` agents around (x, y), normally distributed about that point, each with social
 * reach `reach` (drawn randomly per agent when omitted). Returns the new agents in the order they were added.
 */
export function spawnCluster(world, {x, y, count = 1, reach}) {
    const {rng, params} = world.sim;
    const sigma = SPAWN_SPREAD * Math.sqrt(Math.max(0, count - 1));
    const spawned = [];
    for (let i = 0; i < count; i++) {
        const px = sigma > 0 ? x + rng.normal(0, sigma) : x;
        const py = sigma > 0 ? y + rng.normal(0, sigma) : y;
        const human = world.createHuman({
            x: placeOnMap(px, params.forestwidth, params.wrapped),
            y: placeOnMap(py, params.forestheight, params.wrapped),
            reach,
        });
        world.addHuman(human);
        human.discoverTradesAtBirth();
        spawned.push(human);
    }
    return spawned;
}
