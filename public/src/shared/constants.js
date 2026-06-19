export const MESSAGE_TYPES = {
  WELCOME: "welcome",
  LOBBY_STATE: "lobby:state",
  CHAT_MESSAGE: "chat:message",
  GAME_START: "game:start",
  GAME_OVER: "game:over",
  GAME_TICK: "game:tick",
  ERROR: "error"
};

export const CLIENT_TYPES = {
  JOIN: "join",
  CHAT_MESSAGE: "chat:message",
  INPUT: "player:input"
};

export const ROUTES = {
  HOME: "/",
  NICKNAME: "/nickname",
  LOBBY: "/lobby",
  GAME: "/game",
  WINNER: "/winner"
};

export const PLAYER_COLORS = ["red", "blue", "gold", "green"];
