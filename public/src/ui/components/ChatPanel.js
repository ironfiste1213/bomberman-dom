import { createElement as h } from "../../../mini-framework/create-element.js";

export function ChatPanel({ messages, chatText, setChatText, sendChat }) {
  return h(
    "aside",
    { className: "panel chat-panel" },
    h("div", { className: "section-heading" },
      h("p", { className: "eyebrow" }, "WebSocket chat"),
      h("h2", null, "Team channel")
    ),
    h(
      "ol",
      { className: "chat-log" },
      messages.length
        ? messages.map((message) => ChatMessage(message))
        : h("li", { className: "empty-row" }, "No messages yet")
    ),
    h(
      "form",
      { className: "chat-form", onSubmit: sendChat },
      h("input", {
        name: "message",
        maxlength: "240",
        autocomplete: "off",
        placeholder: "Message",
        value: chatText,
        onInput: (event) => setChatText(event.target.value)
      }),
      h("button", { type: "submit" }, "Send")
    )
  );
}

function ChatMessage(message) {
  return h(
    "li",
    { className: "chat-message", key: message.id },
    h("strong", null, message.nickname),
    h("span", null, message.text)
  );
}
