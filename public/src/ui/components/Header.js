import { createElement as h } from "../../../mini-framework/create-element.js";
import { ROUTES } from "../../shared/constants.js";

export function Header(connection, lobby, joinedNickname, route, game) {
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
