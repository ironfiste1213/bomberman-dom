import { createElement as h } from "../../mini-framework/create-element.js";
import { useEffect, useRef, useState } from "../../mini-framework/hooks.js";
import { initRouter, navigate } from "../../mini-framework/router.js";
import { CLIENT_TYPES, ROUTES } from "../shared/constants.js";
import { engine } from "../game/engine.js";
import { resolveRoute } from "./routes.js";
import { createSocket, handleServerMessage, send } from "./socket.js";
import { emptyLobby } from "./state.js";
import { BlockedScreen } from "../ui/screens/BlockedScreen.js";
import { GameScreen } from "../ui/screens/GameScreen.js";
import { Header } from "../ui/components/Header.js";
import { LobbyScreen } from "../ui/screens/LobbyScreen.js";
import { NicknameScreen } from "../ui/screens/NicknameScreen.js";
import { NotFoundScreen } from "../ui/screens/NotFoundScreen.js";
import { ResultScreen } from "../ui/screens/ResultScreen.js";

export function App() {
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
    engine.socket = socket;

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
