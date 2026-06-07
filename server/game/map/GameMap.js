export default class GameMap {
    constructor() {
        this.grid = [
            "###########",
            "#.........#",
            "#.#.#.#.#.#",
            "#.........#",
            "#.#.#.#.#.#",
            "#.........#",
            "###########"
        ]
    }
    getTile(x, y) {
        return this.grid[y][x];
    }
}