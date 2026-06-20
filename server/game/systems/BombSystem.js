import Bomb from "../entities/bombs.js";

export default class BombSystem {
    static update(state) {
        // Place bombs (max one keypress per tick due to input reset)
        for (const player of state.players.values()) {
            if (!player.alive || player.input.bomb !== true) continue;

            try {
                if (player.activeBombs >= player.bombLimit) continue;

                const tileX = Math.floor(player.x);
                const tileY = Math.floor(player.y);

                const hasNonExplodedBombOnTile = state.bombs.some(
                    (bomb) =>
                        bomb.exploded === false &&
                        Math.floor(bomb.x) === tileX &&
                        Math.floor(bomb.y) === tileY
                );

                if (!hasNonExplodedBombOnTile) {
                    const id = crypto.randomUUID();
                    const bomb = new Bomb(
                        id,
                        player.id,
                        tileX,
                        tileY,
                        player.flameRange
                    );

                    state.bombs.push(bomb);
                    player.activeBombs += 1;
                }
            } finally {
                // Always reset so a single keypress places at most one bomb
                player.input.bomb = false;
            }
        }

        // Countdown timers and flag explosion
        const tickMs = 16.67;
        for (const bomb of state.bombs) {
            if (bomb.exploded === false) {
                bomb.timer -= tickMs;
                if (bomb.timer <= 0) {
                    bomb.exploded = true;
                }
            }
        }
    }
}

