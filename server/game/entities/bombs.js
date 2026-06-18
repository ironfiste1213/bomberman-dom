export default class Bomb {
    constructor(id, ownerId, x, y, range = 1) {
        this.id = id;
        this.ownerId = ownerId;
        this.x = x;
        this.y = y;
        this.range = range;
        this.timer = 3000; // milliseconds
        this.exploded = false;
    }
}