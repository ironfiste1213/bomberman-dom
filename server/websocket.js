import crypto from "node:crypto";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const OPCODES = {
  CONTINUATION: 0x0,
  TEXT: 0x1,
  CLOSE: 0x8,
  PING: 0x9,
  PONG: 0xa
};

export function acceptWebSocket(request, socket, onConnection) {
  const key = request.headers["sec-websocket-key"];

  if (!key || request.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash("sha1")
    .update(key + WS_GUID)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "\r\n"
  ].join("\r\n"));

  const connection = createConnection(socket);
  onConnection(connection, request);
}

function createConnection(socket) {
  let buffer = Buffer.alloc(0);
  let closed = false;
  const listeners = {
    message: new Set(),
    close: new Set()
  };

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const parsed = parseFrames(buffer);
    buffer = parsed.remaining;

    for (const frame of parsed.frames) {
      if (frame.opcode === OPCODES.TEXT) {
        emit("message", frame.payload.toString("utf8"));
      } else if (frame.opcode === OPCODES.PING) {
        sendFrame(socket, OPCODES.PONG, frame.payload);
      } else if (frame.opcode === OPCODES.CLOSE) {
        close();
      }
    }
  });

  socket.on("close", close);
  socket.on("error", close);

  function emit(event, payload) {
    for (const listener of listeners[event]) {
      listener(payload);
    }
  }

  function send(data) {
    if (closed || socket.destroyed) return;
    sendFrame(socket, OPCODES.TEXT, Buffer.from(data));
  }

  function close() {
    if (closed) return;
    closed = true;
    emit("close");
    if (!socket.destroyed) socket.destroy();
  }

  return {
    send,
    close,
    on(event, listener) {
      listeners[event]?.add(listener);
    }
  };
}

function parseFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (payloadLength === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > buffer.length) break;
      const bigLength = buffer.readBigUInt64BE(offset + 2);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error("WebSocket payload too large");
      }
      payloadLength = Number(bigLength);
      headerLength = 10;
    }

    const maskLength = isMasked ? 4 : 0;
    const frameLength = headerLength + maskLength + payloadLength;
    if (offset + frameLength > buffer.length) break;

    const maskStart = offset + headerLength;
    const payloadStart = maskStart + maskLength;
    const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLength));

    if (isMasked) {
      const mask = buffer.subarray(maskStart, maskStart + 4);
      for (let index = 0; index < payload.length; index++) {
        payload[index] ^= mask[index % 4];
      }
    }

    frames.push({ opcode, payload });
    offset += frameLength;
  }

  return {
    frames,
    remaining: buffer.subarray(offset)
  };
}

function sendFrame(socket, opcode, payload) {
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  header[0] = 0x80 | opcode;
  socket.write(Buffer.concat([header, payload]));
}
