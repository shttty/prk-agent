import { createConnection } from "node:net";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function rawGateway(path) {
  const socket = createConnection(path);
  try {
    await new Promise((resolve, reject) => {
      const connected = () => { socket.removeListener("error", failed); resolve(); };
      const failed = (error) => { socket.removeListener("connect", connected); reject(error); };
      socket.once("connect", connected);
      socket.once("error", failed);
    });
  } catch (error) {
    socket.destroy();
    throw error;
  }
  const frames = [];
  const errors = [];
  let buffer = "";
  socket.on("error", (error) => { errors.push(error); });
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    for (;;) {
      const end = buffer.indexOf("\n");
      if (end < 0) break;
      frames.push(JSON.parse(buffer.slice(0, end)));
      buffer = buffer.slice(end + 1);
    }
  });
  return {
    socket,
    frames,
    errors,
    send(value) {
      if (socket.destroyed) throw new Error("Raw Gateway test socket is closed.");
      socket.write(`${JSON.stringify(value)}\n`);
    },
    async waitForFrames(count, description, timeoutMs = 5_000) {
      const deadline = Date.now() + timeoutMs;
      while (frames.length < count) {
        if (errors.length) throw new AggregateError(errors, `${description}: socket failed`);
        if (Date.now() >= deadline) throw new Error(`Timed out: ${description}`);
        await sleep(5);
      }
    },
  };
}
