// Every message sent by the server has a "type".
// Keeping those names here avoids spelling mistakes between server and client.
export const SERVER_MESSAGES = {
  // Sent once when a browser successfully opens the WebSocket connection.
  WELCOME: "welcome",

  // Sent whenever the waiting room changes: player joins, leaves, timer changes.
  LOBBY_STATE: "lobby:state",

  // Sent to all players when someone writes in the chat.
  CHAT_MESSAGE: "chat:message",

  // Sent once the lobby countdown finishes and the game can begin.
  GAME_START: "game:start",

  // Sent after a player joins and receives a temporary resumable session.
  SESSION_JOINED: "session:joined",

  // Sent after a refreshed tab reconnects to its existing player session.
  SESSION_RESUMED: "session:resumed",

  // Sent every game tick with a full state snapshot.
  GAME_TICK: "game:tick",

  // Sent when the match ends.
  GAME_OVER: "game:over",

  // Sent when a player loses a life.
  PLAYER_DIED: "player:died",

  // Sent when the client sends something invalid or the action is refused.
  ERROR: "error"
};

// Message types that the browser/client is allowed to send to the server.
export const CLIENT_MESSAGES = {
  // First real action from a player: choose a nickname and enter the lobby.
  JOIN: "join",

  // Chat text typed by a joined player.
  CHAT_MESSAGE: "chat:message",

  // Movement and action input during a match.
  PLAYER_INPUT: "player:input",

  // Reconnect a refreshed tab to an existing temporary player session.
  SESSION_RESUME: "session:resume",

  // Small connection test message. Useful later for latency/ping display.
  PING: "ping"
};

// Lobby rules from the subject.
export const LOBBY = {
  // The game may start with 2 players minimum.
  MIN_PLAYERS: 2,

  // The game can have at most 4 players.
  MAX_PLAYERS: 4,

  // First player opens a 20 second waiting window.
  WAITING_SECONDS: 20,

  // After enough players join, everybody gets 10 seconds to prepare.
  COUNTDOWN_SECONDS: 10
};

// Starting tile for each player.
// These are grid positions, not pixels.
// Later the map renderer will convert x/y tiles into DOM positions.
export const SPAWNS = [
  { x: 1, y: 1 },
  { x: 13, y: 1 },
  { x: 1, y: 11 },
  { x: 13, y: 11 }
];
