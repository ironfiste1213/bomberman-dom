import Explosion from "../entities/explosion.js";

export default class ExplosionSystem {
    static update(state, recentDeaths = []) {
        const tickMs = 16.67;
        const hitSet = new Set();

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
                }

                state.explosions.push(
                    new Explosion(crypto.randomUUID(), x, y)
                );

                for (const otherBomb of state.bombs) {
                    if (
                        otherBomb.exploded === false &&
                        Math.floor(otherBomb.x) === x &&
                        Math.floor(otherBomb.y) === y
                    ) {
                        otherBomb.exploded = true;
                    }
                }

                for (const player of state.players.values()) {
                    if (Math.floor(player.x) === x && Math.floor(player.y) === y) {
                        // Check alive + per-tick dedupe.
                        ExplosionSystem.damagePlayer(state, player, hitSet, recentDeaths);
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

        // Tick explosions and remove expired ones.
        for (const explosion of state.explosions) {
            explosion.duration -= tickMs;
        }

        state.explosions = state.explosions.filter((e) => e.duration > 0);
    }

    static damagePlayer(state, player, hitSet, recentDeaths) {
        if (!player || player.alive !== true) return;
        if (hitSet.has(player.id)) return;

        hitSet.add(player.id);
        player.lives -= 1;

        if (player.lives <= 0) {
            player.alive = false;
            recentDeaths.push({ id: player.id, nickname: player.nickname });
        }
    }
}

