import crypto from "node:crypto";

// Magic value required by the WebSocket protocol.
// The server combines this with the browser's key to prove it understands WebSockets.
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

// WebSocket frames have numeric operation codes.
// For this project we mainly need text frames, ping/pong, and close.
const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
};

const VALID_CLIENT_OPCODES = new Set([
  OPCODES.CONTINUATION,
  OPCODES.TEXT,
  OPCODES.CLOSE,
  OPCODES.PING,
  OPCODES.PONG
]);

// Turns a normal HTTP upgrade request into a WebSocket connection.
// This replaces using a package like "ws", keeping the server dependency-free.
export function acceptWebSocket(request, socket, onConnection) {
  // Browser sends this header during the opening handshake.
  const key = request.headers["sec-websocket-key"];

  // If this is not a valid WebSocket upgrade request, reject it.
  if (!key || request.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  // Protocol requirement:
  // acceptKey = base64(sha1(browserKey + WebSocketMagicGuid))
  const acceptKey = crypto
    .createHash("sha1") // creat a SHA-1 hashing machine
    .update(key + WS_GUID)// feeds the string into the SHA-1 machine
    .digest("base64");// after the SHA-1 hasing machine creata a bytes we convert them to base64, now it's safe to send in an HTTP headrer

  // HTTP 101 means "Switching Protocols".
  // After this response, the TCP socket is no longer normal HTTP.
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n"
  ].join("\r\n"));

  // Wrap the raw socket in a small friendlier API.
  const connection = createConnection(socket);

  // Hand the connection to the lobby module.
  onConnection(connection, request);
}

// Creates a tiny event-based wrapper around a raw TCP socket.
function createConnection(socket) {
  // Data from TCP can arrive split into chunks.
  // buffer stores incomplete bytes until a full WebSocket frame is available.
  let buffer = Buffer.alloc(0);

  // Prevent duplicate close events.
  let closed = false;

  // Minimal event system used by lobby.js:
  // connection.on("message", ...)
  // connection.on("close", ...)
  const listeners = {
    message: new Set(),
    close: new Set()
  };

  // Every time raw bytes arrive, parse as many complete WebSocket frames as possible.
  socket.on("data", (chunk) => {
    try {
      buffer = Buffer.concat([buffer, chunk]);
      const parsed = parseFrames(buffer);

      // Keep leftover bytes for the next data event.
      buffer = parsed.remaining;

      for (const frame of parsed.frames) {
        // Text frames are the JSON messages from the browser.
        if (frame.opcode === OPCODES.TEXT) {
          emit("message", frame.payload.toString("utf8"));

        // Browsers may ping the server. We answer pong to keep the connection healthy.
        } else if (frame.opcode === OPCODES.PING) {
          sendFrame(socket, OPCODES.PONG, frame.payload);

        // Close frames mean the browser wants to disconnect.
        } else if (frame.opcode === OPCODES.CLOSE) {
          close();
          break;
        }
      }
    } catch (error) {
      // A malformed or oversized frame was received.
      // Destroy the socket silently instead of crashing the process.
      close();
    }
  });

  // Treat socket close and socket error the same for the lobby.
  socket.on("close", close);
  socket.on("error", close);

  // Calls every listener registered for one event.
  function emit(event, payload) {
    for (const listener of listeners[event]) {
      listener(payload);
    }
  }

  // Public send method used by lobby.js.
  // lobby.js passes JSON strings; this function wraps them in a WebSocket text frame.
  function send(data) {
    if (closed || socket.destroyed) return;
    sendFrame(socket, OPCODES.TEXT, Buffer.from(data));
  }

  // Closes the connection and notifies listeners exactly once.
  function close() {
    if (closed) return;
    closed = true;
    emit("close");
    if (!socket.destroyed) socket.destroy();
  }

  // Public API returned to lobby.js.
  return {
    send,
    close,
    on(event, listener) {
      listeners[event]?.add(listener);
    }
  };
}

// Reads WebSocket frames from a buffer.
// Returns complete frames plus any remaining incomplete bytes.
function parseFrames(buffer) {
  const frames = [];
  let offset = 0;

  // Need at least 2 bytes for the smallest WebSocket frame header.
  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];

    // RFC 6455 requires client-to-server frames to be final, masked, and
    // free of reserved extensions unless the server negotiated them.
    const fin = (firstByte & 0x80) === 0x80;
    const reservedBits = firstByte & 0x70;

    // Lower 4 bits of first byte are the opcode.
    const opcode = firstByte & 0x0f;

    if (reservedBits !== 0) {
      throw new Error("WebSocket reserved bits are not supported");
    }

    if (!VALID_CLIENT_OPCODES.has(opcode)) {
      throw new Error(`Unsupported WebSocket opcode: ${opcode}`);
    }

    if (!fin) {
      throw new Error("Fragmented WebSocket frames are not supported");
    }

    // Browser-to-server frames must be masked.
    // The mask is used below to decode the payload.
    const isMasked = (secondByte & 0x80) === 0x80;
    if (!isMasked) {
      throw new Error("Client WebSocket frames must be masked");
    }

    // Lower 7 bits of second byte are either the length or a length marker.
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    // 126 means the real length is stored in the next 2 bytes.
    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;

    // 127 means the real length is stored in the next 8 bytes.
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) break;
      const bigLength = buffer.readBigUInt64BE(offset + 2);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("WebSocket payload too large");
      }
      payloadLength = Number(bigLength);
      headerLength = 10;
    }

    if (opcode >= OPCODES.CLOSE && payloadLength > 125) {
      throw new Error("WebSocket control frame payload too large");
    }

    // Client frames include a 4 byte mask before the payload.
    const maskLength = 4;
    const frameLength = headerLength + maskLength + payloadLength;

    // Full frame has not arrived yet. Stop and wait for more TCP data.
    if (offset + frameLength > buffer.length) break;

    const maskStart = offset + headerLength;
    const payloadStart = maskStart + maskLength;

    // Copy payload bytes so we can safely mutate them while unmasking.
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLength));

    // Decode browser payload by XOR-ing every byte with the 4-byte mask.
    if (isMasked) {
      const mask = buffer.subarray(maskStart, maskStart + 4);
      for (let index = 0; index < payload.length; index++) {
        payload[index] ^= mask[index % 4];
      }
    }

    // Store this complete frame and advance to the next one.
    frames.push({ opcode, payload });
    offset += frameLength;
  }

  // Anything after offset is an incomplete frame, so keep it for later.
  return {
    frames,
    remaining: buffer.subarray(offset)
  };
}

// Writes one server-to-browser WebSocket frame.
// Server frames are not masked; only browser-to-server frames are masked.
function sendFrame(socket, opcode, payload) {
  const length = payload.length;
  let header;

  // Small payload: length fits directly in the second byte.
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;

  // Medium payload: second byte says 126, next 2 bytes contain length.
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);

  // Large payload: second byte says 127, next 8 bytes contain length.
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  // 0x80 marks this as a final frame.
  // OR-ing with opcode says what kind of frame this is.
  header[0] = 0x80 | opcode;

  // Send header followed by payload bytes.
  socket.write(Buffer.concat([header, payload]));
}
