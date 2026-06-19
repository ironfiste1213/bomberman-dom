import { createElement as h } from "../../mini-framework/create-element.js";
import { useEffect, useRef, useState } from "../../mini-framework/hooks.js";
import { initRouter, navigate } from "../../mini-framework/router.js";
import { ROUTES } from "../shared/constants.js";
import { engine } from "../game/engine.js";
import { resolveRoute } from "./routes.js";
import { emptyLobby, normalizeGameOverPayload, normalizeLobby } from "./state.js";
import { BlockedScreen } from "../ui/screens/BlockedScreen.js";
import { GameScreen } from "../ui/screens/GameScreen.js";
import { Header } from "../ui/components/Header.js";
import { LobbyScreen } from "../ui/screens/LobbyScreen.js";
import { NicknameScreen } from "../ui/screens/NicknameScreen.js";
import { NotFoundScreen } from "../ui/screens/NotFoundScreen.js";
import { ResultScreen } from "../ui/screens/ResultScreen.js";

function createWebSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function App() {

  const workerRef = useRef(null);
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

  // connect with our didecated worker

  useEffect(() => {

    const worker = new Worker(new URL("../workers/client-worker.js", import.meta.url));

    workerRef.current = worker;

      // on message : recieve from our worker 

      // post message : send to our worker

    worker.onmessage = (event) => {

      const message = event.data || {};


      const payload = message.payload || {};

        // parse and decide 
      switch (message.type) {

        case "connection:open":

          setConnection((current) => ({ ...current, status: "online" }));
          setError("");
          break;

        case "connection:close":

          setConnection((current) => ({ ...current, status: "offline" }));
          setError("Connection closed. Refresh when the server is ready.");
          break;

        case "connection:error":

          setConnection((current) => ({ ...current, status: "error" }));

          setError(payload.message || "WebSocket connection failed.");

          break;

        case "protocol:error":

          setError(payload.message || "Received invalid server message.");
          break;

        case "server:welcome":

          connectionIdRef.current = payload.id || null;

          setConnection((current) => ({

            ...current,
            id: payload.id,
            maxPlayers: payload.maxPlayers || current.maxPlayers

          }));

          break;

        case "server:lobby-state": {

          const nextLobby = normalizeLobby(payload);
          const currentPlayer = nextLobby.players.find((player) => player.id === connectionIdRef.current);

          setLobby(nextLobby);

          if (currentPlayer && !nextLobby.gameStarted) {
            setJoinedNickname(currentPlayer.nickname || "");
            setBlocked(null);
            setError("");
            navigate(ROUTES.LOBBY);
          }

          break;

        }

        case "server:chat-message":

          setMessages((current) => [...current, payload].slice(-80));

          break;

        case "server:game-tick":

          engine.gameState = payload;
          break;

        case "server:game-start":

          setGame(payload);
          navigate(ROUTES.GAME);

          engine.start({

            map: payload.map,
            sendInput: (input) => {
              worker.postMessage({ type: "player:input", payload: { input } });
            }

          });

          break;

        case "server:game-over":

          engine.stop();
          setGame(null);
          setMatchResult(normalizeGameOverPayload(payload));
          navigate(ROUTES.WINNER);
          break;

        case "server:error":

          if (payload.code === "GAME_ALREADY_STARTED") {
            setJoinedNickname("");
            setBlocked({
              code: payload.code,
              message: payload.message || "Game already started. Wait for the next match."
            });
          }

          setError(payload.message || "Server refused the action.");
          break;

        default:
          setError("Received unknown worker message.");
      }
    };

    worker.onerror = () => {
      setConnection((current) => ({ ...current, status: "error" }));
      setError("Worker transport failed.");
    };

    worker.postMessage({
      type: "connect",
      payload: { wsUrl: createWebSocketUrl() }
    });

    return () => {
      worker.postMessage({ type: "disconnect", payload: {} });
      worker.terminate();
      workerRef.current = null;
    };
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

    if (!workerRef.current) {
      setError("Server is not connected yet.");
      return;
    }

    workerRef.current.postMessage({
      type: "join",
      payload: { nickname: cleanedNickname }
    });
    setError("");
  };

  const sendChat = (event) => {
    event.preventDefault();
    const cleanedText = chatText.trim().replace(/\s+/g, " ");
    if (!cleanedText) return;

    if (!workerRef.current) {
      setError("Cannot send chat while disconnected.");
      return;
    }

    workerRef.current.postMessage({
      type: "chat:send",
      payload: { text: cleanedText }
    });

    setChatText("");
    setError("");
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