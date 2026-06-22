import Explosion from "../entities/explosion.js";
import PowerUp from "../entities/powerUP.js";

const POWERUP_TYPES = ["bombs", "flames", "speed"];
const POWERUP_SPAWN_CHANCE = 0.35;

export default class ExplosionSystem {
    static update(state, recentDeaths = []) {
        const tickMs = 16.67;
        const hitSet = new Set();

        // --- Phase 1: Process newly exploded bombs ---
        for (const bomb of state.bombs) {
            if (bomb.exploded !== true) continue;
            if (bomb.processed === true) continue;

            const tilesToAffect = [];
            const originX = Math.floor(bomb.x);
            const originY = Math.floor(bomb.y);

            tilesToAffect.push({ x: originX, y: originY });

            for (const { dx, dy } of [
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 },
            ]) {
                for (let step = 1; step <= bomb.range; step += 1) {
                    const x = originX + dx * step;
                    const y = originY + dy * step;

                    // Permanent walls stop flame; wall tile unaffected.
                    if (state.map.getTile(x, y) === "W") {
                        break;
                    }

                    tilesToAffect.push({ x, y });

                    // Destructible blocks are destroyed by flame and do not propagate further.
                    if (state.map.isDestructible(x, y)) {
                        break;
                    }
                }
            }

            // Resolve effects for each affected tile.
            for (const { x, y } of tilesToAffect) {
                if (state.map.isDestructible(x, y)) {
                    state.map.blockDead(x, y);
                    // 35% chance to spawn a powerup when a block is destroyed
                    if (Math.random() < POWERUP_SPAWN_CHANCE) {
                        const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
                        state.powerups.push(new PowerUp(crypto.randomUUID(), x, y, type));
                    }
                }

                // Create a new explosion tile with a set to track which players it already hit
                const explosion = new Explosion(crypto.randomUUID(), x, y);
                explosion.hitPlayerIds = new Set();
                state.explosions.push(explosion);

                // Chain reaction: trigger other bombs caught in the explosion
                for (const otherBomb of state.bombs) {
                    if (
                        otherBomb.exploded === false &&
                        Math.floor(otherBomb.x) === x &&
                        Math.floor(otherBomb.y) === y
                    ) {
                        otherBomb.exploded = true;
                    }
                }

                // Damage players on the explosion tile (initial hit)
                for (const player of state.players.values()) {
                    if (Math.floor(player.x + 0.5) === x && Math.floor(player.y + 0.5) === y) {
                        ExplosionSystem.damagePlayer(state, player, hitSet, recentDeaths);
                        if (explosion.hitPlayerIds) explosion.hitPlayerIds.add(player.id);
                    }
                }
            }

            bomb.processed = true;

            const owner = state.players.get(bomb.ownerId);
            if (owner) {
                owner.activeBombs -= 1;
            }
        }

        // Remove bombs already processed (separate pass).
        state.bombs = state.bombs.filter((b) => b.processed !== true);

        // --- Phase 2: Continuous damage — players walking into active explosion tiles ---
        for (const explosion of state.explosions) {
            if (!explosion.hitPlayerIds) explosion.hitPlayerIds = new Set();

            for (const player of state.players.values()) {
                if (!player.alive) continue;
                if (explosion.hitPlayerIds.has(player.id)) continue;

                if (
                    Math.floor(player.x + 0.5) === explosion.x &&
                    Math.floor(player.y + 0.5) === explosion.y
                ) {
                    ExplosionSystem.damagePlayer(state, player, hitSet, recentDeaths);
                    explosion.hitPlayerIds.add(player.id);
                }
            }
        }

        // Tick explosions and remove expired ones.
        for (const explosion of state.explosions) {
            explosion.duration -= tickMs;
        }
        state.explosions = state.explosions.filter((e) => e.duration > 0);
    }

    static damagePlayer(state, player, hitSet, recentDeaths) {
        if (!player || player.alive !== true) return;
        if (hitSet.has(player.id)) return;
        
        const now = Date.now();
        if (player.immunityUntil && now < player.immunityUntil) {
            return;
        }

        hitSet.add(player.id);
        player.lives -= 1;
        player.immunityUntil = now + 1000; // 1 second of immunity

        if (player.lives <= 0) {
            player.alive = false;
            recentDeaths.push({ id: player.id, nickname: player.nickname });
        }
    }
}
