export default class Player {
    constructor(id) {
        this.id = id;

        this.x = 0;
        this.y = 0;

        this.speed = 1;

        this.input = {
            up: false,
            down: false,
            left: false,
            right: false,
        };
    }
}