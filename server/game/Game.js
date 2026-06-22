import GameState from "./GameState.js";
import PlayerSystem from "./systems/PlayerSystem.js";
import BombSystem from "./systems/BombSystem.js";
import ExplosionSystem from "./systems/ExplosionSystem.js";
import Player from "./entities/players.js";

export default class Game {
    constructor() {
        this.state = new GameState();
        this.started = false;
        this.ended = false;
        this.matchPlayers = new Map();
    }

    start(players, seed, density) {
        this.state = new GameState(seed, density);
        this.started = true;
        this.ended = false;
        this.matchPlayers = new Map();

        for (const lobbyPlayer of players) {
            const player = new Player(lobbyPlayer.id, lobbyPlayer.nickname);
            player.playerNumber = lobbyPlayer.playerNumber;
            player.x = lobbyPlayer.spawn.x;
            player.y = lobbyPlayer.spawn.y;
            player.spawn = lobbyPlayer.spawn;
            this.state.players.set(player.id, player);
            this.matchPlayers.set(player.id, this.createMatchPlayer(player));
        }

        return this.state.map.grid;
    }

    setPlayerInput(playerId, input) {
        const player = this.state.players.get(playerId);
        if (!player || !input) return;
        if (!player.alive) return;

        player.input = {
            up: Boolean(input.up),
            down: Boolean(input.down),
            left: Boolean(input.left),
            right: Boolean(input.right),
            bomb: Boolean(input.bomb)
        };
    }

    removePlayer(playerId) {
        const player = this.state.players.get(playerId);
        if (player) {
            this.matchPlayers.set(playerId, {
                ...this.createMatchPlayer(player),
                alive: false,
                result: player.alive === false ? "loser" : "disconnected"
            });
        }

        this.state.players.delete(playerId);
        return this.checkForGameOver("disconnect");
    }

    tick(recentDeaths = []) {
        if (!this.started) return;

        PlayerSystem.update(this.state);
        BombSystem.update(this.state);
        ExplosionSystem.update(this.state, recentDeaths);

        return this.checkForGameOver("last_player_standing");
    }

    checkForGameOver(reason) {
        if (this.ended) return null;

        const alivePlayers = [...this.state.players.values()].filter((player) => player.alive !== false);
        if (alivePlayers.length > 1) return null;

        this.started = false;
        this.ended = true;

        const winner = alivePlayers[0] || null;

        return {
            winner: winner ? this.createResultPlayer(winner, "winner") : null,
            players: [...this.matchPlayers.values()].map((record) =>
                this.createResultPlayerFromRecord(record, winner)
            ),
            reason,
            endedAt: Date.now()
        };
    }

    createMatchPlayer(player) {
        return {
            id: player.id,
            nickname: player.nickname,
            playerNumber: player.playerNumber,
            lives: player.lives,
            alive: player.alive,
            result: ""
        };
    }

    createResultPlayer(player, result = "") {
        return {
            id: player.id,
            nickname: player.nickname,
            playerNumber: player.playerNumber,
            lives: player.lives,
            alive: player.alive,
            result
        };
    }

    createResultPlayerFromRecord(record, winner) {
        if (!record) return null;

        if (record.result === "disconnected") {
            return { ...record, alive: false };
        }

        const currentPlayer = this.state.players.get(record.id);
        if (!currentPlayer) {
            return {
                ...record,
                alive: false,
                result: record.result || "finished"
            };
        }

        if (winner && currentPlayer.id === winner.id) {
            return this.createResultPlayer(currentPlayer, "winner");
        }

        return this.createResultPlayer(
            currentPlayer,
            currentPlayer.alive === false ? "loser" : "finished"
        );
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
                flameRange: player.flameRange,
                immune: player.immunityUntil ? player.immunityUntil > Date.now() : false
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
