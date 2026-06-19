import { createElement as h } from "../../../mini-framework/create-element.js";

export function BlockedScreen({ blocked, retry }) {
  return h(
    "section",
    { className: "panel nickname-panel" },
    h("div", { className: "panel-copy" },
      h("p", { className: "eyebrow" }, "Match unavailable"),
      h("h2", null, "Match already in progress"),
      h("p", null, blocked.message || "You can join when the next lobby opens.")
    ),
    h("button", { type: "button", onClick: retry }, "Retry")
  );
}
