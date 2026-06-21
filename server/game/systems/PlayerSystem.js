export default class PlayerSystem {
    static update(state) {
        for (const player of state.players.values()) {
            if (!player.alive) continue;

            if (player.input.right) {
                const nextX = player.x + player.speed;
                if (this.canMove(state, nextX, player.y, player)) {
                    player.x = nextX;
                }
            }
            if (player.input.left) {
                const nextX = player.x - player.speed
               if (this.canMove(state, nextX, player.y, player)) {
                player.x = nextX
               }
            }
            if (player.input.up) {
                const nextY = player.y - player.speed
                if (this.canMove(state, player.x, nextY, player)) {
                    player.y = nextY
                }
            }
            if (player.input.down) {
                const nextY = player.y + player.speed
                if (this.canMove(state, player.x, nextY, player)) {
                    player.y = nextY
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
                        Math.floor(player.x + 0.5) === powerup.x &&
                        Math.floor(player.y + 0.5) === powerup.y
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
            player.flameRange += 1;
        } else if (type === "speed") {
            player.speed = Math.min(player.speed + 0.03, 0.25);
        }
    }

    static overlapsTile(px, py, tx, ty) {
        const minX = px + 0.15;
        const maxX = px + 0.85;
        const minY = py + 0.15;
        const maxY = py + 0.85;
        return minX < tx + 1 && maxX > tx && minY < ty + 1 && maxY > ty;
    }

    static canMove(state, x, y, player) {
        const minX = x + 0.15;
        const maxX = x + 0.85;
        const minY = y + 0.15;
        const maxY = y + 0.85;

        const startX = Math.floor(minX);
        const endX = Math.floor(maxX);
        const startY = Math.floor(minY);
        const endY = Math.floor(maxY);

        for (let tx = startX; tx <= endX; tx++) {
            for (let ty = startY; ty <= endY; ty++) {
                if (state.map.getTile(tx, ty) !== ".") {
                    if (this.overlapsTile(x, y, tx, ty)) {
                        return false;
                    }
                }
            }
        }

        // Bomb collision
        if (state.bombs && state.bombs.length > 0) {
            for (const bomb of state.bombs) {
                if (bomb.exploded) continue;

                if (this.overlapsTile(x, y, bomb.x, bomb.y)) {
                    if (player) {
                        const currentlyOverlaps = this.overlapsTile(player.x, player.y, bomb.x, bomb.y);
                        if (!currentlyOverlaps) {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
            }
        }

        return true;
    }
}
