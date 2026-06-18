export default class Player {
    constructor(id, nickname) {
        this.id = id;
        this.nickname = nickname;

        this.x = 0;
        this.y = 0;
        this.speed = 0.1;
        this.alive = true;
        this.lives = 3;
        this.bombLimit = 1;
        this.activeBombs = 0;
        this.flameRange = 1;
        this.input = {
            up: false,
            down: false,
            left: false,
            right: false,
        };
    }
}
