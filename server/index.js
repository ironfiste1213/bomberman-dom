import http from "node:http";
import { acceptWebSocket } from "./websocket.js";
import { registerConnection } from "./lobby.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("Bomberman DOM server is running.\n");
});

server.on("upgrade", (request, socket) => {
  if (request.url !== "/ws") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  acceptWebSocket(request, socket, registerConnection);
});

server.listen(PORT, HOST, () => {
  console.log(`Bomberman DOM server listening on http://${HOST}:${PORT}`);
  console.log(`WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
});
