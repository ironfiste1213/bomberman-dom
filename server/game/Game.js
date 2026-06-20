import GameState from "./GameState.js";
import PlayerSystem from "./systems/PlayerSystem.js";
import BombSystem from "./systems/BombSystem.js";
import ExplosionSystem from "./systems/ExplosionSystem.js";
import Player from "./entities/players.js";



export default class Game {
    constructor() {
        this.state = new GameState();
        this.started = false;
    }

    start(players, seed, density) {
        this.state = new GameState(seed, density);
        this.started = true;

        for (const lobbyPlayer of players) {
            const player = new Player(lobbyPlayer.id, lobbyPlayer.nickname);
            player.playerNumber = lobbyPlayer.playerNumber;
            player.x = lobbyPlayer.spawn.x;
            player.y = lobbyPlayer.spawn.y;
            player.spawn = lobbyPlayer.spawn;
            this.state.players.set(player.id, player);
        }

        return this.state.map.grid;
    }

    setPlayerInput(playerId, input) {
        const player = this.state.players.get(playerId);
        if (!player || !input) return;
        if (!player.alive) return

        player.input = {
            up: Boolean(input.up),
            down: Boolean(input.down),
            left: Boolean(input.left),
            right: Boolean(input.right),
            bomb: Boolean(input.bomb)
        };
    }

    removePlayer(playerId) {
        this.state.players.delete(playerId);
    }

    tick(recentDeaths = []) {
        if (!this.started) return;
        PlayerSystem.update(this.state);
        BombSystem.update(this.state);
        ExplosionSystem.update(this.state, recentDeaths);
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
                spawn: player.spawn,
                speed: player.speed,
                bombLimit: player.bombLimit,
                flameRange: player.flameRange
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
