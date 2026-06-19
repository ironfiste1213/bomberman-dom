import { createElement as h } from "./mini-framework/create-element.js";
import { mount } from "./mini-framework/renderer.js";
import { useEffect, useRef, useState } from "./mini-framework/hooks.js";
import { initRouter, navigate } from "./mini-framework/router.js";

const MESSAGE_TYPES = {
  WELCOME: "welcome",
  LOBBY_STATE: "lobby:state",
  CHAT_MESSAGE: "chat:message",
  GAME_START: "game:start",
  GAME_OVER: "game:over",
  GAME_TICK: "game:tick",
  ERROR: "error"
};

const CLIENT_TYPES = {
  JOIN: "join",
  CHAT_MESSAGE: "chat:message",
  INPUT: "player:input"
};

const ROUTES = {
  HOME: "/",
  NICKNAME: "/nickname",
  LOBBY: "/lobby",
  GAME: "/game",
  WINNER: "/winner"
};

const PLAYER_COLORS = ["red", "blue", "gold", "green"];

// ---------------------------------------------------------------------------
// Module-level game engine — lives entirely outside the component tree.
// Started once when the server sends game:start.
// ---------------------------------------------------------------------------
const engine = {
  socket: null,       // set when WS connects
  gameState: null,    // latest snapshot from server
  map: [],            // set when game starts
  rafId: null,
  playerElems: {},
  inputBound: false,

  start(socket, map) {
    this.socket = socket;
    this.map = map || [];
    this.playerElems = {};
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this._startInput();
    this._startRAF();
  },

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.gameState = null;
    this.map = [];
    this.playerElems = {};
  },

  _startInput() {
    if (this.inputBound) return;
    this.inputBound = true;

    const keys = { up: false, down: false, left: false, right: false };
    const KEY_MAP = {
      ArrowUp: "up", w: "up",
      ArrowDown: "down", s: "down",
      ArrowLeft: "left", a: "left",
      ArrowRight: "right", d: "right"
    };
    const push = () => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      console.log("CLIENT sending input:", keys);
      this.socket.send(JSON.stringify({ type: CLIENT_TYPES.INPUT, input: { ...keys } }));
    };
    window.addEventListener("keydown", (e) => {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      if (keys[dir]) return;
      keys[dir] = true;
      push();
    });
    window.addEventListener("keyup", (e) => {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();
      keys[dir] = false;
      push();
    });
  },

  _startRAF() {
    const loop = () => {
      const state = this.gameState;
      if (state && state.map && state.map.grid) {
        this.map = state.map.grid;
      }
      const MAP_COLS = this.map[0]?.length || 15;
      const MAP_ROWS = this.map.length || 13;
      const arena = document.getElementById("arena");
      if (state && arena) {
        // Update tiles dynamically based on block state
        if (state.map && state.map.grid) {
          for (let r = 0; r < state.map.grid.length; r++) {
            const row = state.map.grid[r];
            for (let c = 0; c < row.length; c++) {
              const cell = row[c];
              const tileEl = document.getElementById(`tile-${r}-${c}`);
              if (tileEl) {
                if (cell === ".") {
                  tileEl.className = "tile tile-floor";
                } else if (cell === "W") {
                  tileEl.className = "tile tile-wall";
                } else if (cell === "B") {
                  tileEl.className = "tile tile-block";
                }
              }
            }
          }
        }

        for (const p of state.players) {
          let el = this.playerElems[p.id];
          if (!el) {
            el = document.createElement("div");
            el.className = `player-sprite token-${PLAYER_COLORS[(p.playerNumber - 1) % PLAYER_COLORS.length]}`;
            el.title = p.nickname;
            el.textContent = p.playerNumber;
            arena.appendChild(el);
            this.playerElems[p.id] = el;
          }
          el.style.left = `${(p.x / MAP_COLS) * 100}%`;
          el.style.top  = `${(p.y / MAP_ROWS) * 100}%`;
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
};

function App() {
  const socketRef = useRef(null);
  const connectionIdRef = useRef(null);
  const [route, setRoute] = useState(ROUTES.NICKNAME);
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
  const [blocked, setBlocked] = useState(null);
  const [game, setGame] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    initRouter(setRoute, { mode: "hash" });
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;
    engine.socket = socket; // give engine direct socket access

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
        getConnectionId: () => connectionIdRef.current,
        setConnectionId: (id) => {
          connectionIdRef.current = id;
        },
        setConnection,
        setLobby,
        setMessages,
        setError,
        setBlocked,
        setJoinedNickname,
        setGame,
        setMatchResult
      });
    });

    return () => socket.close();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const guardedRoute = resolveRoute(route, {
      joinedNickname,
      game,
      matchResult
    });

    if (guardedRoute.redirectTo && guardedRoute.redirectTo !== route) {
      navigate(guardedRoute.redirectTo);
    }
  }, [route, joinedNickname, game, matchResult]);

  const joinLobby = (event) => {
    event.preventDefault();
    setBlocked(null);
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

  const returnToNickname = () => {
    setMatchResult(null);
    setJoinedNickname("");
    setLobby(emptyLobby());
    setGame(null);
    setBlocked(null);
    setError("");
    navigate(ROUTES.NICKNAME);
  };

  const guardedRoute = resolveRoute(route, {
    joinedNickname,
    game,
    matchResult
  });
  const activeRoute = guardedRoute.route;

  return h(
    "main",
    { className: "shell" },
    Header(connection, lobby, joinedNickname, activeRoute, game),
    error ? h("p", { className: "notice", role: "alert" }, error) : null,
    blocked
      ? BlockedScreen({
          blocked,
          retry: () => {
            setBlocked(null);
            setError("");
            navigate(ROUTES.NICKNAME);
          }
        })
      : null,
    !blocked && activeRoute === ROUTES.NICKNAME
      ? NicknameScreen({
          nickname,
          setNickname,
          joinLobby,
          connection
        })
      : null,
    !blocked && activeRoute === ROUTES.LOBBY
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
    !blocked && activeRoute === ROUTES.GAME
      ? GameScreen({
          game,
          messages,
          chatText,
          setChatText,
          sendChat
        })
      : null,
    !blocked && activeRoute === ROUTES.WINNER
      ? ResultScreen({
          matchResult,
          currentPlayerId: connection.id,
          navigateToNickname: returnToNickname
        })
      : null,
    !blocked && activeRoute === "not-found"
      ? NotFoundScreen({
          route,
          navigateToNickname: () => navigate(ROUTES.NICKNAME)
        })
      : null
  );
}

function Header(connection, lobby, joinedNickname, route, game) {
  const visibleCount = route === ROUTES.GAME && game && Array.isArray(game.players)
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
  const map = game && Array.isArray(game.map) ? game.map : [];

  const tiles = [];
  if (map.length > 0) {
    for (let r = 0; r < map.length; r++) {
      for (let c = 0; c < map[r].length; c++) {
        const cell = map[r][c];
        let className = "tile-floor";
        if (cell === "W") className = "tile-wall";
        else if (cell === "B") className = "tile-block";
        tiles.push(h("div", {
          id: `tile-${r}-${c}`,
          className: `tile ${className}`,
          style: `grid-column: ${c + 1}; grid-row: ${r + 1};`
        }));
      }
    }
  }

  const cols = map[0]?.length || 11;
  const rows = map.length || 7;

  return h(
    "section",
    { className: "game-layout" },
    h(
      "div",
      { className: "panel arena-panel" },
      h("div", { className: "section-heading" },
        h("p", { className: "eyebrow" }, "Match in progress"),
        h("h2", null, "Arena")
      ),
      h(
        "div",
        {
          id: "arena",
          className: "arena-preview",
          style: `position: relative; display: grid; grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr); gap: 0;`
        },
        ...tiles
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

function ResultScreen({ matchResult, currentPlayerId, navigateToNickname }) {
  const winner = matchResult && matchResult.winner;
  const players = matchResult && Array.isArray(matchResult.players) ? matchResult.players : [];
  const currentPlayer = players.find((player) => player.id === currentPlayerId);
  const didWin = Boolean(winner && winner.id && winner.id === currentPlayerId);
  const didLose = Boolean(currentPlayer && (currentPlayer.result === "loser" || currentPlayer.alive === false));
  const resultTone = didWin ? "win" : didLose ? "lose" : "neutral";
  const title = didWin ? "You won" : didLose ? "You were eliminated" : "Match complete";
  const winnerName = displayPlayerName(winner);
  const winnerNumber = winner && winner.playerNumber ? `P${winner.playerNumber}` : "";
  const reason = resultReasonLabel(matchResult && matchResult.reason);

  return h(
    "section",
    { className: "panel result-panel" },
    h("div", { className: "panel-copy" },
      h("p", { className: "eyebrow" }, "Match result"),
      h("h2", null, title),
      h("p", null, winnerName
        ? `${winnerNumber ? `${winnerNumber} - ` : ""}${winnerName} wins. ${reason}`
        : "The match ended. Waiting for final winner details from the backend.")
    ),
    h(
      "div",
      { className: `result-card result-${resultTone}` },
      h("span", { className: "result-badge" }, didWin ? "Winner" : didLose ? "Eliminated" : "Complete"),
      currentPlayer
        ? h("strong", null, `Your result: ${displayPlayerName(currentPlayer)}`)
        : h("strong", null, "Spectator result"),
      h("small", null, winnerName ? `Winner: ${winnerName}` : "Winner data unavailable")
    ),
    players.length
      ? h(
          "ul",
          { className: "result-list" },
          players.map((player, index) => ResultPlayerRow(player, index, winner))
        )
      : null,
    h("button", { type: "button", onClick: navigateToNickname }, "Back to nickname")
  );
}

function ResultPlayerRow(player, index, winner) {
  const isWinner = Boolean(winner && winner.id && winner.id === player.id);
  const result = isWinner ? "winner" : player.result || (player.alive === false ? "loser" : "finished");

  return h(
    "li",
    { className: "result-row", key: player.id || `${player.nickname}-${index}` },
    h("span", { className: `player-token token-${PLAYER_COLORS[index % PLAYER_COLORS.length]}` }, player.playerNumber || index + 1),
    h("strong", null, displayPlayerName(player)),
    h("small", null, result)
  );
}

function NotFoundScreen({ route, navigateToNickname }) {
  return h(
    "section",
    { className: "panel nickname-panel" },
    h("div", { className: "panel-copy" },
      h("p", { className: "eyebrow" }, "Route not found"),
      h("h2", null, "This page does not exist"),
      h("p", null, `No Bomberman page matches ${route}.`)
    ),
    h("button", { type: "button", onClick: navigateToNickname }, "Back to nickname")
  );
}

function BlockedScreen({ blocked, retry }) {
  return h(
    "section",
    { className: "panel nickname-panel" },
    h("div", { className: "panel-copy" },
      h("p", { className: "eyebrow" }, "Match unavailable"),
      h("h2", null, "Match already in progress"),
      h("p", null, blocked.message || "You can join when the next lobby opens.")
    ),
    h("button", { type: "button", onClick: retry }, "Retry")
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
    actions.setConnectionId(payload.id || null);
    actions.setConnection((current) => ({
      ...current,
      id: payload.id,
      maxPlayers: payload.maxPlayers || current.maxPlayers
    }));
    return;
  }

  if (message.type === MESSAGE_TYPES.LOBBY_STATE) {
    const lobby = normalizeLobby(payload);
    const currentPlayer = lobby.players.find((player) => player.id === actions.getConnectionId());

    actions.setLobby(lobby);

    if (currentPlayer && !lobby.gameStarted) {
      actions.setJoinedNickname(currentPlayer.nickname || "");
      actions.setBlocked(null);
      actions.setError("");
      navigate(ROUTES.LOBBY);
    }
    return;
  }

  if (message.type === MESSAGE_TYPES.CHAT_MESSAGE) {
    actions.setMessages((current) => [...current, payload].slice(-80));
    return;
  }

  if (message.type === MESSAGE_TYPES.GAME_TICK) {
    engine.gameState = payload;
    return;
  }

  if (message.type === MESSAGE_TYPES.GAME_START) {
    actions.setGame(payload);
    navigate(ROUTES.GAME);
    // engine.socket is already set; start input capture + RAF loop once.
    engine.start(engine.socket, payload.map);
    return;
  }

  if (message.type === MESSAGE_TYPES.GAME_OVER) {
    engine.stop();
    actions.setGame(null);
    actions.setMatchResult(normalizeGameOverPayload(payload));
    navigate(ROUTES.WINNER);
    return;
  }

  if (message.type === MESSAGE_TYPES.ERROR) {
    if (payload.code === "GAME_ALREADY_STARTED") {
      actions.setJoinedNickname("");
      actions.setBlocked({
        code: payload.code,
        message: payload.message || "Game already started. Wait for the next match."
      });
    }

    actions.setError(payload.message || "Server refused the action.");
    return;
  }
}

function resolveRoute(route, state) {
  const normalizedRoute = normalizeRoute(route);

  if (normalizedRoute === ROUTES.HOME) {
    return { route: ROUTES.NICKNAME, redirectTo: ROUTES.NICKNAME };
  }

  if (normalizedRoute === ROUTES.NICKNAME) {
    if (state.game) {
      return { route: ROUTES.GAME, redirectTo: ROUTES.GAME };
    }
    if (state.joinedNickname) {
      return { route: ROUTES.LOBBY, redirectTo: ROUTES.LOBBY };
    }
    return { route: ROUTES.NICKNAME };
  }

  if (normalizedRoute === ROUTES.LOBBY) {
    if (state.game) {
      return { route: ROUTES.GAME, redirectTo: ROUTES.GAME };
    }
    if (!state.joinedNickname) {
      return { route: ROUTES.NICKNAME, redirectTo: ROUTES.NICKNAME };
    }
    return { route: ROUTES.LOBBY };
  }

  if (normalizedRoute === ROUTES.GAME) {
    if (!state.game) {
      return {
        route: state.joinedNickname ? ROUTES.LOBBY : ROUTES.NICKNAME,
        redirectTo: state.joinedNickname ? ROUTES.LOBBY : ROUTES.NICKNAME
      };
    }
    return { route: ROUTES.GAME };
  }

  if (normalizedRoute === ROUTES.WINNER) {
    if (!state.matchResult) {
      const fallbackRoute = state.game
        ? ROUTES.GAME
        : state.joinedNickname
          ? ROUTES.LOBBY
          : ROUTES.NICKNAME;
      return { route: fallbackRoute, redirectTo: fallbackRoute };
    }
    return { route: ROUTES.WINNER };
  }

  return { route: "not-found" };
}

function normalizeRoute(route) {
  if (!route || typeof route !== "string") return ROUTES.HOME;
  return route.startsWith("/") ? route : `/${route}`;
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

function normalizeGameOverPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const winner = normalizeResultPlayer(source.winner || source.player || source);
  const players = Array.isArray(source.players)
    ? source.players.map(normalizeResultPlayer).filter(Boolean)
    : winner
      ? [winner]
      : [];

  return {
    winner,
    players,
    reason: typeof source.reason === "string" ? source.reason : "last_player_standing",
    endedAt: source.endedAt || Date.now()
  };
}

function normalizeResultPlayer(player) {
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

function displayPlayerName(player) {
  if (!player) return "";
  return player.nickname || player.name || (player.playerNumber ? `Player ${player.playerNumber}` : "Unknown player");
}

function resultReasonLabel(reason) {
  if (reason === "last_player_standing") return "Last player standing.";
  if (reason === "all_opponents_eliminated") return "All opponents eliminated.";
  if (reason === "disconnect") return "Match ended after a disconnect.";
  return "Match ended.";
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
