const SERVER_TO_MAIN = {
  welcome: "server:welcome",
  "lobby:state": "server:lobby-state",
  "chat:message": "server:chat-message",
  "game:start": "server:game-start",
  "game:tick": "server:game-tick",
  "game:over": "server:game-over",
  error: "server:error"
};

let socket = null;


// self (worker scoop) 
// self.onmessage listen to our main thread
// self.postmessage write to our main thread

self.onmessage = (event) => {

  const message = event.data || {};
  const payload = message.payload || {};

  switch (message.type) {

    case "connect":

      if (!payload.wsUrl) {

        self.postMessage({
          type: "protocol:error",
          payload: { message: "Worker connect requires a WebSocket URL." }
        });

        break;
      }

      if (socket) socket.close();

      socket = new WebSocket(payload.wsUrl);

      // if our socket open success send it to main thread
      socket.onopen = () => {
        self.postMessage({ type: "connection:open", payload: {} });
      };

      // if our socket close success send it to main thread
      socket.onclose = () => {
        self.postMessage({ type: "connection:close", payload: {} });
        socket = null;
      };

      // if our socket have error send it to main thread
      socket.onerror = () => {
        self.postMessage({
          type: "connection:error",
          payload: { message: "WebSocket connection failed." }
        });
      };

      // listen to socket messages and decide wich action can we do 

      socket.onmessage = (socketEvent) => {

        let serverMessage;

        try {

          serverMessage = JSON.parse(socketEvent.data);

        } catch {

          self.postMessage({
            type: "protocol:error",
            payload: { message: "Received invalid server message." }
          });

          return;
        }

        const type = SERVER_TO_MAIN[serverMessage.type];

        if (!type) {

          self.postMessage({
            type: "protocol:error",
            payload: { message: `Received unknown server message: ${serverMessage.type || "missing type"}.` }
          });
          
          return;
        }

        self.postMessage({ type, payload: serverMessage.payload || {} });

      };

      break;

    case "disconnect":

      if (socket) socket.close();
      socket = null;
      break;

    case "join":

      if (!socket || socket.readyState !== WebSocket.OPEN) {

        self.postMessage({
          type: "protocol:error",
          payload: { message: "Server is not connected yet." }
        });

        break;
      }
      socket.send(JSON.stringify({ type: "join", nickname: payload.nickname }));

      break;

    case "chat:send":

      if (!socket || socket.readyState !== WebSocket.OPEN) {
        self.postMessage({
          type: "protocol:error",
          payload: { message: "Server is not connected yet." }
        });

        break;

      }

      socket.send(JSON.stringify({ type: "chat:message", text: payload.text }));

      break;

    case "player:input":

      if (!socket || socket.readyState !== WebSocket.OPEN) {

        self.postMessage({
          type: "protocol:error",
          payload: { message: "Server is not connected yet." }
        });

        break;
      }

      socket.send(JSON.stringify({ type: "player:input", input: payload.input }));

      break;

    default:
      self.postMessage({
        type: "protocol:error",
        payload: { message: `Received unknown worker command: ${message.type || "missing type"}.` }
      });
  }
};