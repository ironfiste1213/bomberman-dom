import http from "node:http";
import { acceptWebSocket } from "./websocket.js";
import { registerConnection } from "./lobby.js";
import Game from "./game/Game.js";
import GameLoop from "./game/GameLoop.js";



const game = new Game();
const loop = new GameLoop(game);

loop.start();
// Allow PORT/HOST to be changed from the terminal:
// PORT=4000 npm start
// If nothing is provided, the server uses port 3000 and listens on all interfaces.
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

// This HTTP server does two jobs:
// 1. answer normal HTTP requests, like /health
// 2. upgrade WebSocket requests, handled below with server.on("upgrade")
const server = http.createServer((request, response) => {
  // Simple endpoint to check if the server process is alive.
  // Later this is useful for debugging without opening the game.
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  // Default response when someone opens http://localhost:3000 in the browser.
  // For now we only confirm the server is running.
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("Bomberman DOM server is running.\n");
});

// Browsers start WebSocket connections as an HTTP request with an "Upgrade" header.
// Node exposes that moment through the "upgrade" event.
server.on("upgrade", (request, socket) => {
  // Only /ws is accepted as the WebSocket route.
  // Any other upgrade request is rejected.
  if (request.url !== "/ws") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  // acceptWebSocket does the low-level WebSocket handshake.
  // registerConnection receives a cleaner object with .send() and .on().
  acceptWebSocket(request, socket, registerConnection);
});

// Start listening for HTTP and WebSocket traffic.
server.listen(PORT, HOST, () => {
  console.log(`Bomberman DOM server listening on http://${HOST}:${PORT}`);
  console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
});
