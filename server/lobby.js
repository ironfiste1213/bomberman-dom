import crypto from "node:crypto";
import { CLIENT_MESSAGES, LOBBY, SERVER_MESSAGES, SPAWNS } from "./protocol.js";

const players = new Map();
let nextPlayerNumber = 1;
let waitingTimer = null;
let countdownTimer = null;
let waitingEndsAt = null;
let countdownEndsAt = null;
let gameStarted = false;

export function registerConnection(connection) {
  const client = {
    id: crypto.randomUUID(),
    connection,
    nickname: null,
    playerNumber: null,
    joinedAt: null
  };

  send(client, SERVER_MESSAGES.WELCOME, {
    id: client.id,
    maxPlayers: LOBBY.MAX_PLAYERS
  });

  connection.on("message", (rawMessage) => {
    handleMessage(client, rawMessage);
  });

  connection.on("close", () => {
    removeClient(client);
  });
}

function handleMessage(client, rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    send(client, SERVER_MESSAGES.ERROR, { message: "Invalid JSON message." });
    return;
  }

  if (message.type === CLIENT_MESSAGES.JOIN) {
    joinLobby(client, message.nickname);
    return;
  }

  if (!players.has(client.id)) {
    send(client, SERVER_MESSAGES.ERROR, { message: "Join the lobby before sending messages." });
    return;
  }

  if (message.type === CLIENT_MESSAGES.CHAT_MESSAGE) {
    sendChatMessage(client, message.text);
    return;
  }

  if (message.type === CLIENT_MESSAGES.PING) {
    send(client, "pong", { now: Date.now() });
    return;
  }

  send(client, SERVER_MESSAGES.ERROR, { message: `Unknown message type: ${message.type}` });
}

function joinLobby(client, nickname) {
  if (gameStarted) {
    send(client, SERVER_MESSAGES.ERROR, { message: "A game is already running." });
    return;
  }

  if (players.has(client.id)) {
    send(client, SERVER_MESSAGES.ERROR, { message: "You are already in the lobby." });
    return;
  }

  if (players.size >= LOBBY.MAX_PLAYERS) {
    send(client, SERVER_MESSAGES.ERROR, { message: "Lobby is full." });
    return;
  }

  const cleanedNickname = sanitizeNickname(nickname);
  if (!cleanedNickname) {
    send(client, SERVER_MESSAGES.ERROR, { message: "Nickname must be 2-16 visible characters." });
    return;
  }

  client.nickname = cleanedNickname;
  client.playerNumber = nextPlayerNumber++;
  client.joinedAt = Date.now();
  players.set(client.id, client);

  if (!waitingTimer) {
    waitingEndsAt = Date.now() + LOBBY.WAITING_SECONDS * 1000;
    waitingTimer = setTimeout(() => {
      waitingTimer = null;
      waitingEndsAt = null;
      if (players.size >= LOBBY.MIN_PLAYERS) {
        startCountdown();
      } else {
        broadcastLobbyState();
      }
    }, LOBBY.WAITING_SECONDS * 1000);
  }

  if (players.size === LOBBY.MAX_PLAYERS) {
    startCountdown();
  }

  broadcastLobbyState();
}

function sendChatMessage(client, text) {
  const cleanedText = sanitizeChatText(text);
  if (!cleanedText) return;

  broadcast(SERVER_MESSAGES.CHAT_MESSAGE, {
    id: crypto.randomUUID(),
    playerId: client.id,
    nickname: client.nickname,
    text: cleanedText,
    sentAt: Date.now()
  });
}

function startCountdown() {
  if (countdownTimer || gameStarted) return;

  if (waitingTimer) {
    clearTimeout(waitingTimer);
    waitingTimer = null;
    waitingEndsAt = null;
  }

  countdownEndsAt = Date.now() + LOBBY.COUNTDOWN_SECONDS * 1000;
  countdownTimer = setTimeout(() => {
    countdownTimer = null;
    countdownEndsAt = null;
    startGame();
  }, LOBBY.COUNTDOWN_SECONDS * 1000);

  broadcastLobbyState();
}

function startGame() {
  if (gameStarted || players.size < LOBBY.MIN_PLAYERS) {
    broadcastLobbyState();
    return;
  }

  gameStarted = true;
  const gamePlayers = getPlayers().map((player, index) => ({
    id: player.id,
    nickname: player.nickname,
    playerNumber: player.playerNumber,
    lives: 3,
    spawn: SPAWNS[index]
  }));

  broadcast(SERVER_MESSAGES.GAME_START, {
    startedAt: Date.now(),
    players: gamePlayers
  });
}

function removeClient(client) {
  if (!players.delete(client.id)) return;

  if (!gameStarted && players.size < LOBBY.MIN_PLAYERS && countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
    countdownEndsAt = null;
  }

  broadcastLobbyState();
}

function broadcastLobbyState() {
  broadcast(SERVER_MESSAGES.LOBBY_STATE, {
    players: getPlayers().map((player) => ({
      id: player.id,
      nickname: player.nickname,
      playerNumber: player.playerNumber
    })),
    playerCount: players.size,
    minPlayers: LOBBY.MIN_PLAYERS,
    maxPlayers: LOBBY.MAX_PLAYERS,
    waitingEndsAt,
    countdownEndsAt,
    gameStarted
  });
}

function getPlayers() {
  return [...players.values()].sort((left, right) => left.playerNumber - right.playerNumber);
}

function broadcast(type, payload) {
  for (const player of players.values()) {
    send(player, type, payload);
  }
}

function send(client, type, payload) {
  client.connection.send(JSON.stringify({ type, payload }));
}

function sanitizeNickname(nickname) {
  if (typeof nickname !== "string") return "";
  const cleaned = nickname.trim().replace(/\s+/g, " ");
  if (cleaned.length < 2 || cleaned.length > 16) return "";
  return cleaned;
}

function sanitizeChatText(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/\s+/g, " ").slice(0, 240);
}
