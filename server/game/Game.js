import GameState from "./GameState.js";


export default class Game {
    constructor() {
        this.state = new GameState();
    }

    tick() {
        console.log("tik tok hhhh ");
        
    }
}