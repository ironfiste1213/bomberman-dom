export default class GameState {
    constructor() {
        this.players = new Map();
        this.bombs =  [];
        this.powerups = [];
        this.blocks = [];
    }
}