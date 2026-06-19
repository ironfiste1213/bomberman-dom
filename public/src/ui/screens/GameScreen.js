import { createElement as h } from "../../../mini-framework/create-element.js";
import { PLAYER_COLORS } from "../../shared/constants.js";
import { ChatPanel } from "../components/ChatPanel.js";

export function GameScreen({ game, messages, chatText, setChatText, sendChat }) {
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
