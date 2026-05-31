export const SERVER_MESSAGES = {
  WELCOME: "welcome",
  LOBBY_STATE: "lobby:state",
  CHAT_MESSAGE: "chat:message",
  GAME_START: "game:start",
  ERROR: "error"
};

export const CLIENT_MESSAGES = {
  JOIN: "join",
  CHAT_MESSAGE: "chat:message",
  PING: "ping"
};

export const LOBBY = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  WAITING_SECONDS: 20,
  COUNTDOWN_SECONDS: 10
};

export const SPAWNS = [
  { x: 1, y: 1 },
  { x: 13, y: 1 },
  { x: 1, y: 11 },
  { x: 13, y: 11 }
];
