export default class PlayerSystem {
    static update(state) {
        for (const player of state.players.values()) {

            if (player.input.right) {
                player.x += 1;
            }

        }
    }
}