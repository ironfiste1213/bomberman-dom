export function emptyLobby() {
  return {
    players: [],
    playerCount: 0,
    minPlayers: 2,
    maxPlayers: 4,
    waitingEndsAt: null,
    countdownEndsAt: null,
    gameStarted: false
  };
}

export function normalizeLobby(payload) {
  return {
    players: Array.isArray(payload.players) ? payload.players : [],
    playerCount: Number(payload.playerCount || 0),
    minPlayers: Number(payload.minPlayers || 2),
    maxPlayers: Number(payload.maxPlayers || 4),
    waitingEndsAt: payload.waitingEndsAt || null,
    countdownEndsAt: payload.countdownEndsAt || null,
    gameStarted: Boolean(payload.gameStarted)
  };
}

export function normalizeGameOverPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const players = Array.isArray(source.players)
    ? source.players.map(normalizeResultPlayer).filter(Boolean)
    : [];
  const inferredWinner = players.find((player) => player.result === "winner") || null;
  const winner = normalizeResultPlayer(source.winner || source.player || inferredWinner || source);
  const normalizedPlayers = players.length
    ? players
    : winner
      ? [winner]
      : [];

  return {
    winner,
    players: normalizedPlayers,
    reason: typeof source.reason === "string" ? source.reason : "last_player_standing",
    endedAt: source.endedAt || Date.now()
  };
}

export function normalizeResultPlayer(player) {
  if (!player || typeof player !== "object") return null;

  const id = typeof player.id === "string" ? player.id : "";
  const nickname = typeof player.nickname === "string"
    ? player.nickname
    : typeof player.name === "string"
      ? player.name
      : "";

  if (!id && !nickname) return null;

  return {
    id,
    nickname,
    playerNumber: Number(player.playerNumber || 0),
    lives: Number(player.lives || 0),
    alive: player.alive === undefined ? undefined : Boolean(player.alive),
    result: typeof player.result === "string" ? player.result : ""
  };
}

export function displayPlayerName(player) {
  if (!player) return "";
  return player.nickname || player.name || (player.playerNumber ? `Player ${player.playerNumber}` : "Unknown player");
}

export function resultReasonLabel(reason) {
  if (reason === "last_player_standing") return "Last player standing.";
  if (reason === "all_opponents_eliminated") return "All opponents eliminated.";
  if (reason === "disconnect") return "Match ended after a disconnect.";
  return "Match ended.";
}

export function timerLabel(lobby, now) {
  if (lobby.countdownEndsAt) {
    return `Match starts in ${secondsLeft(lobby.countdownEndsAt, now)}s`;
  }

  if (lobby.waitingEndsAt) {
    return `Waiting window ${secondsLeft(lobby.waitingEndsAt, now)}s`;
  }

  return "Waiting for players";
}

export function secondsLeft(target, now) {
  return Math.max(0, Math.ceil((target - now) / 1000));
}
