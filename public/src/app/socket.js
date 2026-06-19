import { navigate } from "../../mini-framework/router.js";
import { MESSAGE_TYPES, ROUTES } from "../shared/constants.js";
import { engine } from "../game/engine.js";
import { normalizeGameOverPayload, normalizeLobby } from "./state.js";

export function createSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${window.location.host}/ws`);
}

export function send(socket, message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
}

export function handleServerMessage(rawMessage, actions) {
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
  }
}
