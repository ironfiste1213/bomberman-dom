import { createElement as h } from "../../../mini-framework/create-element.js";

export function NotFoundScreen({ route, navigateToNickname }) {
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
