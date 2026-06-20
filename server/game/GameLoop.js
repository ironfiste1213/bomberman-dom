export  default class GameLoop {
    constructor(game, onTick = () => {}, onGameOver = () => {}) {
        this.game = game;
        this.onTick = onTick;
        this.onGameOver = onGameOver;
        this.lastTime = Date.now();
        this.interval = null;
    }

    start() {
        this.interval = setInterval(() => {
            const now = Date.now();
            this.lastTime = now
            const gameOverPayload = this.game.tick();
            if (gameOverPayload) {
                this.onGameOver(gameOverPayload);
                return;
            }
            if (this.game.started) {
                this.onTick(this.game.snapshot());
            }
        }, 1000/60);
    }

    stop() {
        clearInterval(this.interval)
    }
}
