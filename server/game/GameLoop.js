export  default class GameLoop {
    constructor(game) {
        this.game = game;
        this.lastTime = Date.now();
        this.interval = null;
    }

    start() {
        this.interval = setInterval(() => {
            const now = Date.now();
            this.lastTime = now
            this.game.tick();
        }, 1000/60);
    }

    stop() {
        clearInterval(this.interval)
    }
}


