import GameState from "./GameState.js";
import PlayerSystem from "./systems/PlayerSystem.js";

export default class Game {
    constructor() {
        this.state = new GameState();
        this.state.players.set("1", {
            id: "1",
            x: 0,
            y:0,
            input: {
                right: true
            }
        })
    }

    tick() {
        PlayerSystem.update(this.state)
    }
}
