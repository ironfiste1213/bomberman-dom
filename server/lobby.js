import crypto from "node:crypto";
import { CLIENT_MESSAGES, LOBBY, SERVER_MESSAGES, SPAWNS } from "./protocol.js";

// In-memory list of currently joined players.
// Key = player id, value = client object.
// This resets when the Node server restarts, which is fine for now.
const players = new Map();

// Human-friendly player number: Player 1, Player 2, etc.
// This keeps increasing so numbers do not collide during one server run.
let nextPlayerNumber = 1;

// Timer that waits up to 20 seconds after the first player joins.
let waitingTimer = null;

// Timer that counts down 10 seconds before the game starts.
let countdownTimer = null;

// Absolute timestamps sent to the client.
// The client can calculate remaining seconds using Date.now().
let waitingEndsAt = null;
let countdownEndsAt = null;

// Once true, new players cannot join this simple one-room server.
let gameStarted = false;
let gameStartPayload = null;

let gameHandlers = {
  onGameStart: () => {},
  onPlayerInput: () => {},
  onPlayerLeave: () => {},
  onGameOver: () => {}
};

// Called once for every browser WebSocket connection.
// At this point the browser is connected, but it has not joined the lobby yet.
export function registerConnection(connection, handlers = {}) {
  gameHandlers = {
    ...gameHandlers,
    ...handlers
  };

  // The client object is our server-side record for one browser connection.
  const client = {
    // randomUUID gives every connection a unique id.
    id: crypto.randomUUID(),

    // Low-level WebSocket wrapper created in websocket.js.
    connection,

    // Filled only after the player sends a "join" message.
    nickname: null,
    playerNumber: null,
    joinedAt: null
  };

  // Tell the browser that the WebSocket works and give it its server id.
  send(client, SERVER_MESSAGES.WELCOME, {
    id: client.id,
    maxPlayers: LOBBY.MAX_PLAYERS
  });

  // Every text message from the browser comes here first.
  connection.on("message", (rawMessage) => {
    handleMessage(client, rawMessage);
  });

  // When the browser tab closes or disconnects, remove that player immediately.
  connection.on("close", () => {
    removeClientConnection(client, connection);
  });
}

// Parses and routes all messages coming from one client.
function handleMessage(client, rawMessage) {
  let message;

  // WebSocket messages are plain text, so we expect JSON strings.
  // Example from client:
  // { "type": "join", "nickname": "mimo" }
  try {
    message = JSON.parse(rawMessage);
  } catch {
    send(client, SERVER_MESSAGES.ERROR, { message: "Invalid JSON message." });
    return;
  }

  // Joining is allowed before the player is registered in the lobby.
  if (message.type === CLIENT_MESSAGES.JOIN) {
    joinLobby(client, message.nickname);
    return;
  }

  // After this point, the client must already be in the players Map.
  // This stops random connected sockets from chatting or controlling the game.
  if (!players.has(client.id)) {
    sendError(client, "JOIN_REQUIRED", "Join the lobby before sending messages.");
    return;
  }

  // Chat message from a real joined player.
  if (message.type === CLIENT_MESSAGES.CHAT_MESSAGE) {
    sendChatMessage(client, message.text);
    return;
  }

  // Match input will be handled by the game loop; accept it as a valid message.
  if (message.type === CLIENT_MESSAGES.PLAYER_INPUT) {
    if (!gameStarted) {
      send(client, SERVER_MESSAGES.ERROR, { message: "Game has not started yet." });
      return;
    }

    gameHandlers.onPlayerInput(client.id, message.input);
    return;
  }

  // Tiny debug/helper response. The client may use this later to measure delay.
  if (message.type === CLIENT_MESSAGES.PING) {
    send(client, "pong", { now: Date.now() });
    return;
  }

  // Anything else is rejected clearly instead of failing silently.
  send(client, SERVER_MESSAGES.ERROR, { message: `Unknown message type: ${message.type}` });
}

// Adds a connected browser to the lobby as an actual player.
function joinLobby(client, nickname) {
  // This first version supports one match per server process.
  // Later we can add rooms if we want multiple matches at the same time.
  if (gameStarted || countdownTimer || countdownEndsAt) {
    sendError(client, "GAME_ALREADY_STARTED", "Game already started. Wait for the next match.");
    return;
  }

  // Prevent the same connection from joining twice.
  if (players.has(client.id)) {
    sendError(client, "ALREADY_JOINED", "You are already in the lobby.");
    return;
  }

  // Subject says max 4 players.
  if (players.size >= LOBBY.MAX_PLAYERS) {
    sendError(client, "LOBBY_FULL", "Lobby is full.");
    return;
  }

  // Clean nickname before storing it.
  const cleanedNickname = sanitizeNickname(nickname);
  if (!cleanedNickname) {
    sendError(client, "INVALID_NICKNAME", "Nickname must be 2-16 visible characters.");
    return;
  }

  // Prevent two players from using the same name.
  const nicknameKey = normalizeNicknameKey(cleanedNickname);
  const nicknameAlreadyTaken = [...players.values()].some(
    (player) => normalizeNicknameKey(player.nickname) === nicknameKey
  );
  if (nicknameAlreadyTaken) {
    sendError(client, "NICKNAME_TAKEN", `Nickname "${cleanedNickname}" is already taken.`);
    return;
  }

  // Store the player info on this connection.
  client.nickname = cleanedNickname;
  client.playerNumber = nextPlayerNumber++;
  client.joinedAt = Date.now();

  // From this line, the client is officially in the lobby.
  players.set(client.id, client);

  // The first joined player starts the 20 second waiting timer.
  // If we reach at least 2 players by the end, the 10 second countdown starts.
  if (!waitingTimer) {
    waitingEndsAt = Date.now() + LOBBY.WAITING_SECONDS * 1000;
    waitingTimer = setTimeout(() => {
      // Clear timer references first so future logic knows it is no longer active.
      waitingTimer = null;
      waitingEndsAt = null;

      if (players.size >= LOBBY.MIN_PLAYERS) {
        startCountdown();
      } else {
        // Still only one player: keep waiting, but notify the client state changed.
        broadcastLobbyState();
      }
    }, LOBBY.WAITING_SECONDS * 1000);
  }

  // If the lobby fills before 20 seconds, start the 10 second countdown immediately.
  if (players.size === LOBBY.MAX_PLAYERS) {
    startCountdown();
  }

  // Send fresh lobby info to everyone after this join.
  broadcastLobbyState();
}

// Sends one chat message to every player in the lobby.
function sendChatMessage(client, text) {
  const cleanedText = sanitizeChatText(text);
  if (!cleanedText) return;

  // Broadcast includes who sent it and when, so the client can render a chat log.
  broadcast(SERVER_MESSAGES.CHAT_MESSAGE, {
    id: crypto.randomUUID(),
    playerId: client.id,
    nickname: client.nickname,
    text: cleanedText,
    sentAt: Date.now()
  });
}

// Starts the final 10 second countdown before the match begins.
function startCountdown() {
  // Avoid starting two countdowns.
  if (countdownTimer || gameStarted) return;

  // Once countdown starts, the 20 second waiting timer is no longer needed.
  if (waitingTimer) {
    clearTimeout(waitingTimer);
    waitingTimer = null;
    waitingEndsAt = null;
  }

  // Store the timestamp instead of sending "10, 9, 8..."
  // This keeps the server simple and lets each client display the remaining time.
  countdownEndsAt = Date.now() + LOBBY.COUNTDOWN_SECONDS * 1000;
  countdownTimer = setTimeout(() => {
    countdownTimer = null;
    countdownEndsAt = null;
    startGame();
  }, LOBBY.COUNTDOWN_SECONDS * 1000);

  // Tell clients that countdownEndsAt now exists.
  broadcastLobbyState();
}

// Creates the initial game-start data and sends it to all players.
function startGame() {
  // Safety check: the game only starts once and only with enough players.
  if (gameStarted || players.size < LOBBY.MIN_PLAYERS) {
    broadcastLobbyState();
    return;
  }

  gameStarted = true;

  // Convert lobby players into game players.
  // Each gets 3 lives and one corner spawn.
  const gamePlayers = getPlayers().map((player, index) => ({
    id: player.id,
    nickname: player.nickname,
    playerNumber: player.playerNumber,
    lives: 3,
    spawn: SPAWNS[index],
    isBot: Boolean(player.isBot)
  }));

  const mapGrid = gameHandlers.onGameStart(gamePlayers);
  gameStartPayload = {
    startedAt: Date.now(),
    players: gamePlayers,
    map: mapGrid
  };

  // The client will use this message to leave the waiting room and render the game.
  broadcast(SERVER_MESSAGES.GAME_START, gameStartPayload);
}

function removeClientConnection(client, connection) {
  const player = players.get(client.id);

  // If this socket was never joined, there is nothing to remove.
  if (!player || player.connection !== connection) return;

  players.delete(player.id);

  if (gameStarted) {
    removePlayerFromGameStartPayload(player.id);
    const gameOverPayload = gameHandlers.onPlayerLeave(player.id);
    if (gameOverPayload) {
      gameHandlers.onGameOver(gameOverPayload);
    }
  } else {
    syncLobbyTimersAfterPlayerRemoval();
    broadcastLobbyState();
  }
}

function syncLobbyTimersAfterPlayerRemoval() {
  if (gameStarted) return;

  if (players.size === 0) {
    clearLobbyTimer(waitingTimer);
    clearLobbyTimer(countdownTimer);
    waitingTimer = null;
    countdownTimer = null;
    waitingEndsAt = null;
    countdownEndsAt = null;
    return;
  }

  // If we were counting down but dropped below 2 players, cancel the countdown.
  if (players.size < LOBBY.MIN_PLAYERS && countdownTimer) {
    clearLobbyTimer(countdownTimer);
    countdownTimer = null;
    countdownEndsAt = null;
  }
}

function clearLobbyTimer(timer) {
  if (timer) {
    clearTimeout(timer);
  }
}

function removePlayerFromGameStartPayload(playerId) {
  if (!gameStartPayload || !Array.isArray(gameStartPayload.players)) return;
  gameStartPayload = {
    ...gameStartPayload,
    players: gameStartPayload.players.filter((player) => player.id !== playerId)
  };
}

// Sends the whole lobby state to every joined player.
// This is easier than sending tiny partial updates and keeps the client simple.
function broadcastLobbyState() {
  broadcast(SERVER_MESSAGES.LOBBY_STATE, lobbyStatePayload());
}

function lobbyStatePayload() {
  return {
    // Only send public player data.
    // Do not send socket objects or internal server fields.
    players: getPlayers().map((player) => ({
      id: player.id,
      nickname: player.nickname,
      playerNumber: player.playerNumber,
      isBot: Boolean(player.isBot)
    })),
    playerCount: players.size,
    minPlayers: LOBBY.MIN_PLAYERS,
    maxPlayers: LOBBY.MAX_PLAYERS,
    waitingEndsAt,
    countdownEndsAt,
    gameStarted
  };
}

// Returns players in stable order.
// This makes spawn assignment predictable: first joined gets first spawn, etc.
function getPlayers() {
  return [...players.values()].sort((left, right) => left.playerNumber - right.playerNumber);
}

// Sends the same message to all joined players.
function broadcast(type, payload) {
  for (const player of players.values()) {
    send(player, type, payload);
  }
}

export function broadcastGameTick(payload) {
  if (!gameStarted) return;
  broadcast(SERVER_MESSAGES.GAME_TICK, payload);
}

export function broadcastGameOver(payload) {
  if (!gameStarted) return;
  broadcast(SERVER_MESSAGES.GAME_OVER, payload);
  resetMatchState();
}

// Converts a JS object into JSON and sends it through the WebSocket.
// All server messages follow this shape:
// { type: "some:type", payload: { ...data } }
function send(client, type, payload) {
  if (!client.connection) return;
  client.connection.send(JSON.stringify({ type, payload }));
}

function sendError(client, code, message) {
  send(client, SERVER_MESSAGES.ERROR, { code, message });
}

function resetMatchState() {
  clearLobbyTimer(waitingTimer);
  clearLobbyTimer(countdownTimer);

  waitingTimer = null;
  countdownTimer = null;
  waitingEndsAt = null;
  countdownEndsAt = null;
  gameStarted = false;
  gameStartPayload = null;
  nextPlayerNumber = 1;
  players.clear();
}

// Makes sure nickname is usable before entering the lobby.
function sanitizeNickname(nickname) {
  if (typeof nickname !== "string") return "";

  // trim removes spaces at start/end.
  // replace(/\s+/g, " ") turns many spaces/newlines into one normal space.
  const cleaned = nickname.trim().replace(/\s+/g, " ");

  // Keep names short enough for UI labels.
  if (cleaned.length < 2 || cleaned.length > 16) return "";
  return cleaned;
}

// Normalizes nicknames for uniqueness checks while preserving the original
// cleaned nickname for display.
function normalizeNicknameKey(nickname) {
  return sanitizeNickname(nickname).toLowerCase();
}

// Cleans chat text before broadcasting it.
function sanitizeChatText(text) {
  if (typeof text !== "string") return "";

  // 240 chars prevents massive messages from breaking the chat UI.
  return text.trim().replace(/\s+/g, " ").slice(0, 240);
}
