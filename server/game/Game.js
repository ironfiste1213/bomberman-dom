import GameState from "./GameState.js";
import PlayerSystem from "./systems/PlayerSystem.js";
import Player from "./entities/players.js";

export default class Game {
    constructor() {
        this.state = new GameState();
        this.started = false;
    }

    start(players) {
        this.state = new GameState();
        this.started = true;

        for (const lobbyPlayer of players) {
            const player = new Player(lobbyPlayer.id, lobbyPlayer.nickname);
            player.playerNumber = lobbyPlayer.playerNumber;
            player.x = lobbyPlayer.spawn.x;
            player.y = lobbyPlayer.spawn.y;
            player.spawn = lobbyPlayer.spawn;
            this.state.players.set(player.id, player);
        }
    }

    setPlayerInput(playerId, input) {
        const player = this.state.players.get(playerId);
        if (!player || !input) return;

        player.input = {
            up: Boolean(input.up),
            down: Boolean(input.down),
            left: Boolean(input.left),
            right: Boolean(input.right)
        };
    }

    removePlayer(playerId) {
        this.state.players.delete(playerId);
    }

    tick() {
        if (!this.started) return;
        PlayerSystem.update(this.state)
    }

    snapshot() {
        return {
            players: [...this.state.players.values()].map((player) => ({
                id: player.id,
                nickname: player.nickname,
                playerNumber: player.playerNumber,
                x: player.x,
                y: player.y,
                lives: player.lives,
                alive: player.alive,
                spawn: player.spawn
            })),
            map: {
                width: this.state.map.width,
                height: this.state.map.height,
                grid: this.state.map.grid
            },
            bombs: this.state.bombs,
            powerups: this.state.powerups,
            blocks: this.state.blocks,
            explosions: this.state.explosions,
            serverTime: Date.now()
        };
    }
}
