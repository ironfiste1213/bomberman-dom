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
    }

    static canMove(state, x, y) {
        const tileX = Math.floor(x);
        const tileY = Math.floor(y);
        const tile = state.map.getTile(tileX, tileY);
        return tile === ".";
    }
}