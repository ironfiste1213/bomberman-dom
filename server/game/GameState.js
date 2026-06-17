import GameMap from "./map/GameMap.js";

export default class GameState {
    constructor() {
        this.map = new GameMap();
        this.players = new Map();
        this.bombs =  [];
        this.powerups = [];
        this.blocks = [];
        this.explosions = [];
    }
}
