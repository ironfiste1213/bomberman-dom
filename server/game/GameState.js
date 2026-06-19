import GameMap from "./map/GameMap.js";

export default class GameState {
    constructor(seed, density) {
        this.map = new GameMap(seed, density);
        this.players = new Map();
        this.bombs =  [];
        this.powerups = [];
        this.blocks = [];
        this.explosions = [];
    }
}
