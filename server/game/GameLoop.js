export  default class GameLoop {
    constructor(game, onTick = () => {}) {
        this.game = game;
        this.onTick = onTick;
        this.lastTime = Date.now();
        this.interval = null;
    }

    start() {
        this.interval = setInterval(() => {
            const now = Date.now();
            this.lastTime = now
            this.game.tick();
            if (this.game.started) {
                this.onTick(this.game.snapshot());
            }
        }, 1000/60);
    }

    stop() {
        clearInterval(this.interval)
    }
}

