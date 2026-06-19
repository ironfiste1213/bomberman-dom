import { createElement as h } from "../../../mini-framework/create-element.js";
import { PLAYER_COLORS } from "../../shared/constants.js";
import { timerLabel } from "../../app/state.js";
import { ChatPanel } from "../components/ChatPanel.js";

export function LobbyScreen({ lobby, messages, chatText, setChatText, sendChat, now, connection }) {
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
