import { createElement as h } from "../../../mini-framework/create-element.js";
import { PLAYER_COLORS } from "../../shared/constants.js";
import { displayPlayerName, resultReasonLabel } from "../../app/state.js";

export function ResultScreen({ matchResult, currentPlayerId, navigateToNickname }) {
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
