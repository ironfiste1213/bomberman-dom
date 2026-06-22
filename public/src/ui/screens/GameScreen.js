import { createElement as h } from "../../../mini-framework/create-element.js";
import { PLAYER_COLORS } from "../../shared/constants.js";
import { ChatPanel } from "../components/ChatPanel.js";

export function GameScreen({ game, messages, chatText, setChatText, sendChat, currentPlayerId }) {
  // read the current list of players and the grid map structure from the state update
  const players = game && Array.isArray(game.players) ? game.players : [];
  const map = game && Array.isArray(game.map) ? game.map : [];

  // find our player status to see if we are still alive or watching the match
  const me = currentPlayerId ? players.find((p) => p.id === currentPlayerId) : null;
  const isEliminated = Boolean(me && me.alive === false);

  // parse current powerup counts and speed tier calculations based on coordinates speed value
  const speedTier = me ? Math.round(((me.speed || 0.1) - 0.1) / 0.03) + 1 : 1;
  const bombLimit = me ? (me.bombLimit || 1) : 1;
  const flameRange = me ? (me.flameRange || 1) : 1;

  // build a visual panel to present stats and collected powerup tiers in the HUD
  const powerupTracker = h(
    "div",
    { className: "powerup-tracker-bar" },
    h("div", { className: "powerup-tracker-title" }, "Your Stats & Powerups"),
    h("div", { className: "powerup-tracker-stats" },
      h("div", { className: "powerup-stat-card powerup-stat-bombs" },
        h("span", { className: "powerup-stat-icon" }, "💣"),
        h("div", { className: "powerup-stat-info" },
          h("span", { className: "powerup-stat-label" }, "Max Bombs"),
          h("strong", { className: "powerup-stat-value" }, bombLimit)
        )
      ),
      h("div", { className: "powerup-stat-card powerup-stat-flames" },
        h("span", { className: "powerup-stat-icon" }, "🔥"),
        h("div", { className: "powerup-stat-info" },
          h("span", { className: "powerup-stat-label" }, "Flame Range"),
          h("strong", { className: "powerup-stat-value" }, flameRange)
        )
      ),
      h("div", { className: "powerup-stat-card powerup-stat-speed" },
        h("span", { className: "powerup-stat-icon" }, "⚡"),
        h("div", { className: "powerup-stat-info" },
          h("span", { className: "powerup-stat-label" }, "Speed"),
          h("strong", { className: "powerup-stat-value" }, `Tier ${speedTier}`)
        )
      )
    )
  );

  // generate the initial layout coordinates for solid walls, destructible blocks, and floor tiles
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

  // extract actual map dimensions to style the columns and rows CSS template
  const cols = map[0]?.length || 11;
  const rows = map.length || 7;

  return h(
    "section",
    { className: "game-layout" },
    h(
      "div",
      { className: "panel arena-panel" },
      h("div", { className: "section-heading" },
        h("p", { className: "eyebrow" }, isEliminated ? "Eliminated" : "Match in progress"),
        h("h2", null, isEliminated ? "Spectator view" : "Arena")
      ),
      isEliminated
        ? h(
            "div",
            { className: "elimination-banner" },
            h("strong", null, "You were eliminated."),
            h("p", null, "Stay here to watch the rest of the match while the surviving players continue.")
          )
        : powerupTracker,
      // create the container element that holds game tiles and allows the engine to append player/bomb sprites
      h(
        "div",
        {
          id: "arena",
          className: `arena-preview${isEliminated ? " arena-preview-eliminated" : ""}`,
          style: `position: relative; display: grid; grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr); gap: 0;`
        },
        ...tiles
      ),
      // render the scores, lives, nicknames, and styling of each participating player
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
