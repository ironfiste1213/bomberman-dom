# Bomberman DOM Frontend Rulebook

This file is the setup agreement before frontend implementation. It translates the subject, the current backend protocol, and the mini-framework constraint into practical rules for our first commits.

## Mission

Build the browser frontend for `bomberman-dom` using the mini-framework from `mini-framework-final`.

The frontend must support:

- nickname entry
- waiting lobby with player counter and timers
- WebSocket chat
- transition into the game screen when the backend sends `game:start`
- DOM-only game rendering
- performance discipline around `requestAnimationFrame`

The team task is frontend-focused. Backend code should only be changed when the frontend cannot be served or tested without a small integration change.

## Hard Subject Rules

- Use the custom mini-framework.
- Do not use React, Vue, Angular, Svelte, or another frontend framework.
- Do not use `canvas`.
- Do not use WebGL.
- Render the game with normal DOM elements and CSS.
- Use WebSockets for multiplayer communication and chat.
- Use `requestAnimationFrame` for game-screen rendering work.
- Keep the game smooth at 60fps.
- Measure performance during development.

## Current Backend Contract

The stable first frontend target is the lobby protocol in `server/lobby.js` and `server/protocol.js`.

Client sends:

```json
{ "type": "join", "nickname": "player-name" }
```

```json
{ "type": "chat:message", "text": "hello" }
```

Optional debug ping:

```json
{ "type": "ping" }
```

Server sends:

```json
{ "type": "welcome", "payload": { "id": "...", "maxPlayers": 4 } }
```

```json
{
  "type": "lobby:state",
  "payload": {
    "players": [],
    "playerCount": 1,
    "minPlayers": 2,
    "maxPlayers": 4,
    "waitingEndsAt": 0,
    "countdownEndsAt": null,
    "gameStarted": false
  }
}
```

```json
{
  "type": "chat:message",
  "payload": {
    "id": "...",
    "playerId": "...",
    "nickname": "...",
    "text": "...",
    "sentAt": 0
  }
}
```

```json
{
  "type": "game:start",
  "payload": {
    "startedAt": 0,
    "players": [
      {
        "id": "...",
        "nickname": "...",
        "playerNumber": 1,
        "lives": 3,
        "spawn": { "x": 1, "y": 1 }
      }
    ]
  }
}
```

Errors use:

```json
{ "type": "error", "payload": { "message": "..." } }
```

## First Frontend Commit Scope

The first frontend commit should be safe, real, and audit-friendly:

- serve a browser app from the existing Node server
- copy or integrate the mini-framework modules into the client app
- create a nickname screen
- open WebSocket connection to `/ws`
- join the lobby with nickname validation
- render lobby players, player count, waiting timer, and countdown timer
- implement chat send/receive
- handle server errors visibly
- transition to a simple game screen when `game:start` arrives

This commit should not implement full player movement, bombs, explosions, or powerups yet.

## Second Frontend Commit Scope

The second frontend commit can start the actual DOM game surface:

- fixed full-map board visible to all players
- DOM tiles for walls, empty cells, destructible blocks
- DOM players placed from backend spawns
- player HUD with nicknames and lives
- local `requestAnimationFrame` loop for display-only timing and FPS measurement
- CSS transform-based positioning for moving entities

This commit can still avoid gameplay networking until the backend has a clear input/state protocol.

## Frontend Architecture Rules

- Keep canonical multiplayer state from the server.
- Keep UI state local only for forms, connection status, chat input, selected nickname, and display timers.
- Do not let the client invent final game results.
- Use one WebSocket client module responsible for connect, send, receive, and reconnect/error state.
- Use one app state object for route/screen data.
- Keep render functions small: `NicknameScreen`, `LobbyScreen`, `ChatPanel`, `GameScreen`, `Board`.
- Prefer CSS classes and transforms over frequent layout-changing style edits.
- Use stable keys in VDOM lists.
- Never store DOM nodes as game state unless a measured performance issue forces it.

## Performance Rules

- Use `requestAnimationFrame` on the game screen.
- Do not run heavy work inside event handlers.
- Batch visual updates through state/render boundaries.
- Prefer `transform: translate3d(...)` for moving players and bombs.
- Avoid changing grid layout every frame.
- Avoid measuring layout (`getBoundingClientRect`, `offsetWidth`, etc.) inside the frame loop unless cached.
- Add a small FPS meter or performance debug overlay during development.
- Use browser DevTools Performance before final audit.

## Known Backend Risks

These are not frontend blockers, but the frontend should not pretend they are solved:

- `server/game/Game.js` starts a dummy ticking player immediately.
- `GameMap` is currently 11x7, but lobby spawns include positions like `{ "x": 13, "y": 11 }`, suggesting a future 15x13 board.
- The backend has lobby/chat/game-start protocol, but no complete gameplay state protocol yet.
- `Player` uses `flagRange`, likely intended to become `flameRange`.

Frontend should therefore begin with lobby/chat and a simple game-start view, then wait for or define the gameplay protocol with the backend teammate.

## Tooling Setup

Use what is already available:

- WSL Node/npm to run the server.
- Browser or Playwright for real UI testing.
- Chrome/Firefox DevTools Performance for FPS evidence.
- No Docker MCP required right now.
- No 3D, WebGL, Unity, Unreal, Blender, or asset-generation pipeline needed for this subject.

## Working Agreement

Before coding:

1. Check `git status`.
2. Keep changes scoped to frontend setup or a clearly named integration need.
3. Do not rewrite backend gameplay files unless the team explicitly agrees.
4. Test with multiple browser tabs because the lobby requires 2-4 players.
5. Commit in small reviewable steps.
