export default class PlayerSystem {
    static update(state) {
        for (const player of state.players.values()) {
            if (player.input.right) {
                const nextX = player.x + player.speed;
                if (this.canMove(state, nextX, player.y)) {
                    player.x = nextX;
                }
            }
            if (player.input.left) {
                const nextX = player.x - player.speed
               if (this.canMove(state, nextX, player.y)) {
                player.x = nextX
               }
            }
            if (player.input.up) {
                const nextY = player.y - player.speed
                if (this.canMove(state, player.x, nextY)) {
                    player.y = nextY
                }
            }
            if (player.input.down) {
                const nextY = player.y + player.speed
                if (this.canMove(state, player.x, nextY)) {
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
            player.flameRange += 1;
        } else if (type === "speed") {
            player.speed = Math.min(player.speed + 0.03, 0.25);
        }
    }

    static canMove(state, x, y) {
        const tileX = Math.floor(x);
        const tileY = Math.floor(y);
        const tile = state.map.getTile(tileX, tileY);
        return tile === ".";
    }
}