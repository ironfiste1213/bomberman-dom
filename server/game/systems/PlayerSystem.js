export default class PlayerSystem {
    static update(state) {
        for (const player of state.players.values()) {
            if (!player.alive) continue;

            if (player.input.right) {
                const nextX = player.x + player.speed;
                if (this.canMove(state, player, nextX, player.y)) {
                    player.x = nextX;
                }
            }
            if (player.input.left) {
                const nextX = player.x - player.speed;
                if (this.canMove(state, player, nextX, player.y)) {
                    player.x = nextX;
                }
            }
            if (player.input.up) {
                const nextY = player.y - player.speed;
                if (this.canMove(state, player, player.x, nextY)) {
                    player.y = nextY;
                }
            }
            if (player.input.down) {
                const nextY = player.y + player.speed;
                if (this.canMove(state, player, player.x, nextY)) {
                    player.y = nextY;
                }
            }
        }

        // Powerup pickup detection
        if (state.powerups.length > 0) {
            const toRemove = new Set();
            for (const powerup of state.powerups) {
                for (const player of state.players.values()) {
                    if (!player.alive) continue;
                    if (
                        Math.floor(player.x) === powerup.x &&
                        Math.floor(player.y) === powerup.y
                    ) {
                        PlayerSystem.applyPowerUp(player, powerup.type);
                        toRemove.add(powerup.id);
                        break; // one pickup per powerup
                    }
                }
            }
            if (toRemove.size > 0) {
                state.powerups = state.powerups.filter((p) => !toRemove.has(p.id));
            }
        }
    }

    static applyPowerUp(player, type) {
        if (type === "bombs") {
            player.bombLimit += 1;
        } else if (type === "flames") {
            // Permanent range increase: each flame pickup adds +1 block to explosion range
            player.flameRange += 1;
        } else if (type === "speed") {
            player.speed = Math.min(player.speed + 0.03, 0.25);
        }
    }

    // Returns true if position (x, y) is walkable for the given player.
    // A tile is walkable if it is a floor tile and does not contain an active bomb
    // the player is not already standing on (so they can walk off but not back on).
    static canMove(state, player, x, y) {
        const tileX = Math.floor(x);
        const tileY = Math.floor(y);
        const tile = state.map.getTile(tileX, tileY);
        if (tile !== ".") return false;

        const playerTileX = Math.floor(player.x);
        const playerTileY = Math.floor(player.y);

        for (const bomb of state.bombs) {
            if (bomb.exploded) continue;
            const bombTileX = Math.floor(bomb.x);
            const bombTileY = Math.floor(bomb.y);
            if (bombTileX === tileX && bombTileY === tileY) {
                // Allow stepping off the bomb tile, but not onto it from another tile
                if (playerTileX === bombTileX && playerTileY === bombTileY) {
                    return true;
                }
                return false;
            }
        }
        return true;
    }
}
