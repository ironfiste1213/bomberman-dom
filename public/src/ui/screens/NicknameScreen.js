import { createElement as h } from "../../../mini-framework/create-element.js";

export function NicknameScreen({ nickname, setNickname, joinLobby, connection }) {
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
