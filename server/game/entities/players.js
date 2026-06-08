export default class Player {
    constructor(id) {
        this.id = id;

        this.x = 0;
        this.y = 0;
        this.speed = 0.1;
        this.lives = 3;
        this.bombLimit = 1;
        this.activeBombs = 0;
        this.flagRange = 1;
        this.input = {
            up: false,
            down: false,
            left: false,
            right: false,
        };
    }
}
