import { createElement as h } from "./mini-framework/create-element.js";
import { mount } from "./mini-framework/renderer.js";
import { useEffect, useRef, useState } from "./mini-framework/hooks.js";

const MESSAGE_TYPES = {
  WELCOME: "welcome",
  LOBBY_STATE: "lobby:state",
  CHAT_MESSAGE: "chat:message",
  GAME_START: "game:start",
  GAME_TICK: "game:tick",
  GAME_OVER: "game:over",
  PLAYER_DIED: "player:died",
  ERROR: "error"
};

const CLIENT_TYPES = {
  JOIN: "join",
  CHAT_MESSAGE: "chat:message",
  PLAYER_INPUT: "player:input"
};

const SCREENS = {
  NICKNAME: "nickname",
  LOBBY: "lobby",
  GAME: "game"
};

const PLAYER_COLORS = ["red", "blue", "gold", "green"];

function App() {
  const socketRef = useRef(null);
  const [screen, setScreen] = useState(SCREENS.NICKNAME);
  const [connection, setConnection] = useState({
    status: "connecting",
    id: null,
    maxPlayers: 4
  });
  const [nickname, setNickname] = useState("");
  const [joinedNickname, setJoinedNickname] = useState("");
  const [lobby, setLobby] = useState(emptyLobby());
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [game, setGame] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setConnection((current) => ({ ...current, status: "online" }));
    });

    socket.addEventListener("close", () => {
      setConnection((current) => ({ ...current, status: "offline" }));
      setError("Connection closed. Refresh when the server is ready.");
    });

    socket.addEventListener("error", () => {
      setConnection((current) => ({ ...current, status: "error" }));
      setError("WebSocket connection failed.");
    });

    socket.addEventListener("message", (event) => {
      handleServerMessage(event.data, {
        setConnection,
        setLobby,
        setMessages,
        setError,
        setGame,
        setScreen
      });
    });

    return () => socket.close();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, []);

  const joinLobby = (event) => {
    event.preventDefault();
    const cleanedNickname = nickname.trim().replace(/\s+/g, " ");

    if (cleanedNickname.length < 2 || cleanedNickname.length > 16) {
      setError("Nickname must be 2-16 visible characters.");
      return;
    }

    if (!send(socketRef.current, {
      type: CLIENT_TYPES.JOIN,
      nickname: cleanedNickname
    })) {
      setError("Server is not connected yet.");
      return;
    }

    setError("");
    setJoinedNickname(cleanedNickname);
    setScreen(SCREENS.LOBBY);
  };

  const sendChat = (event) => {
    event.preventDefault();
    const cleanedText = chatText.trim().replace(/\s+/g, " ");
    if (!cleanedText) return;

    if (send(socketRef.current, {
      type: CLIENT_TYPES.CHAT_MESSAGE,
      text: cleanedText
    })) {
      setChatText("");
      setError("");
    } else {
      setError("Cannot send chat while disconnected.");
    }
  };

  return h(
    "main",
    { className: "shell" },
    Header(connection, lobby, joinedNickname, screen, game),
    error ? h("p", { className: "notice", role: "alert" }, error) : null,
    screen === SCREENS.NICKNAME
      ? NicknameScreen({
          nickname,
          setNickname,
          joinLobby,
          connection
        })
      : null,
    screen === SCREENS.LOBBY
      ? LobbyScreen({
          lobby,
          messages,
          chatText,
          setChatText,
          sendChat,
          now,
          connection
        })
      : null,
    screen === SCREENS.GAME
      ? GameScreen({
          game,
          messages,
          chatText,
          setChatText,
          sendChat
        })
      : null
  );
}

function Header(connection, lobby, joinedNickname, screen, game) {
  const visibleCount = screen === SCREENS.GAME && game && Array.isArray(game.players)
    ? game.players.length
    : lobby.playerCount;
  const maxPlayers = lobby.maxPlayers || connection.maxPlayers;

  return h(
    "header",
    { className: "topbar" },
    h(
      "div",
      null,
      h("p", { className: "eyebrow" }, "Bomberman DOM"),
      h("h1", null, joinedNickname ? `Ready room: ${joinedNickname}` : "Enter the arena")
    ),
    h(
      "div",
      { className: "status-strip" },
      h("span", { className: `dot dot-${connection.status}` }),
      h("span", null, connection.status),
      h("strong", null, `${visibleCount}/${maxPlayers}`)
    )
  );
}

function NicknameScreen({ nickname, setNickname, joinLobby, connection }) {
  const canJoin = connection.status === "online";

  return h(
    "section",
    { className: "panel nickname-panel" },
    h("div", { className: "panel-copy" },
      h("p", { className: "eyebrow" }, "Lobby access"),
      h("h2", null, "Choose your player name"),
      h("p", null, "Names are shown in the waiting room, chat, and game HUD.")
    ),
    h(
      "form",
      { className: "join-form", onSubmit: joinLobby },
      h("label", { for: "nickname" }, "Nickname"),
      h("input", {
        id: "nickname",
        name: "nickname",
        maxlength: "16",
        minlength: "2",
        autocomplete: "off",
        placeholder: "2-16 characters",
        value: nickname,
        onInput: (event) => setNickname(event.target.value)
      }),
      h(
        "button",
        {
          type: "submit",
          disabled: canJoin ? undefined : true
        },
        canJoin ? "Join lobby" : "Connecting"
      )
    )
  );
}

function LobbyScreen({ lobby, messages, chatText, setChatText, sendChat, now, connection }) {
  return h(
    "section",
    { className: "lobby-layout" },
    h(
      "div",
      { className: "panel players-panel" },
      h("div", { className: "section-heading" },
        h("p", { className: "eyebrow" }, "Waiting room"),
        h("h2", null, lobby.gameStarted ? "Starting match" : timerLabel(lobby, now))
      ),
      h("div", { className: "meter", "aria-label": "Player count" },
        h("span", {
          className: "meter-fill",
          style: `width: ${(lobby.playerCount / lobby.maxPlayers) * 100}%`
        })
      ),
      h("ul", { className: "player-list" },
        lobby.players.length
          ? lobby.players.map((player, index) => PlayerRow(player, index))
          : h("li", { className: "empty-row" }, "Waiting for first player")
      ),
      h("p", { className: "rule-line" },
        lobby.playerCount >= lobby.minPlayers
          ? "Minimum players reached. Countdown starts after the waiting window or when the lobby fills."
          : `Need ${lobby.minPlayers - lobby.playerCount} more player to start.`
      ),
      h("p", { className: "connection-note" }, `Socket: ${connection.status}`)
    ),
    ChatPanel({
      messages,
      chatText,
      setChatText,
      sendChat
    })
  );
}

function PlayerRow(player, index) {
  return h(
    "li",
    { className: "player-row", key: player.id },
    h("span", { className: `player-token token-${PLAYER_COLORS[index % PLAYER_COLORS.length]}` }, player.playerNumber),
    h("span", null, player.nickname),
    h("small", null, `P${player.playerNumber}`)
  );
}

function ChatPanel({ messages, chatText, setChatText, sendChat }) {
  return h(
    "aside",
    { className: "panel chat-panel" },
    h("div", { className: "section-heading" },
      h("p", { className: "eyebrow" }, "WebSocket chat"),
      h("h2", null, "Team channel")
    ),
    h(
      "ol",
      { className: "chat-log" },
      messages.length
        ? messages.map((message) => ChatMessage(message))
        : h("li", { className: "empty-row" }, "No messages yet")
    ),
    h(
      "form",
      { className: "chat-form", onSubmit: sendChat },
      h("input", {
        name: "message",
        maxlength: "240",
        autocomplete: "off",
        placeholder: "Message",
        value: chatText,
        onInput: (event) => setChatText(event.target.value)
      }),
      h("button", { type: "submit" }, "Send")
    )
  );
}

function ChatMessage(message) {
  return h(
    "li",
    { className: "chat-message", key: message.id },
    h("strong", null, message.nickname),
    h("span", null, message.text)
  );
}

function GameScreen({ game, messages, chatText, setChatText, sendChat }) {
  const players = game && Array.isArray(game.players) ? game.players : [];

  return h(
    "section",
    { className: "game-layout" },
    h(
      "div",
      { className: "panel arena-panel" },
      h("div", { className: "section-heading" },
        h("p", { className: "eyebrow" }, "Match signal received"),
        h("h2", null, "Game screen armed")
      ),
      h("div", { className: "arena-preview" },
        players.map((player, index) => SpawnMarker(player, index))
      ),
      h("ul", { className: "hud-list" },
        players.map((player, index) => h(
          "li",
          { key: player.id },
          h("span", { className: `player-token token-${PLAYER_COLORS[index % PLAYER_COLORS.length]}` }, player.playerNumber),
          h("strong", null, player.nickname),
          h("span", null, `${player.lives} lives`)
        ))
      )
    ),
    ChatPanel({
      messages,
      chatText,
      setChatText,
      sendChat
    })
  );
}

function SpawnMarker(player, index) {
  const spawn = player.spawn || { x: 1, y: 1 };
  const left = (spawn.x / 14) * 100;
  const top = (spawn.y / 12) * 100;

  return h(
    "span",
    {
      className: `spawn-marker token-${PLAYER_COLORS[index % PLAYER_COLORS.length]}`,
      key: player.id,
      style: `left: ${left}%; top: ${top}%;`
    },
    player.playerNumber
  );
}

function handleServerMessage(rawMessage, actions) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    actions.setError("Received invalid server message.");
    return;
  }

  const payload = message.payload || {};

  if (message.type === MESSAGE_TYPES.WELCOME) {
    actions.setConnection((current) => ({
      ...current,
      id: payload.id,
      maxPlayers: payload.maxPlayers || current.maxPlayers
    }));
    return;
  }

  if (message.type === MESSAGE_TYPES.LOBBY_STATE) {
    actions.setLobby(normalizeLobby(payload));
    return;
  }

  if (message.type === MESSAGE_TYPES.CHAT_MESSAGE) {
    actions.setMessages((current) => [...current, payload].slice(-80));
    return;
  }

  if (message.type === MESSAGE_TYPES.GAME_START) {
    actions.setGame(payload);
    actions.setScreen(SCREENS.GAME);
    return;
  }

  if (message.type === MESSAGE_TYPES.ERROR) {
    actions.setError(payload.message || "Server refused the action.");
    return;
  }
}

function createSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${window.location.host}/ws`);
}

function send(socket, message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

function emptyLobby() {
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

function normalizeLobby(payload) {
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

function timerLabel(lobby, now) {
  if (lobby.countdownEndsAt) {
    return `Match starts in ${secondsLeft(lobby.countdownEndsAt, now)}s`;
  }

  if (lobby.waitingEndsAt) {
    return `Waiting window ${secondsLeft(lobby.waitingEndsAt, now)}s`;
  }

  return "Waiting for players";
}

function secondsLeft(target, now) {
  return Math.max(0, Math.ceil((target - now) / 1000));
}

mount(App, "#app");
