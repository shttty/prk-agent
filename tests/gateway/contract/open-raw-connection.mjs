import { once } from "node:events";
import { createConnection } from "node:net";

export async function raw(path) {
  const socket = createConnection(path); socket.on("error", () => {});
  await once(socket, "connect");
  const frames = []; let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    for (;;) { const end = buffer.indexOf("\n"); if (end < 0) break; frames.push(JSON.parse(buffer.slice(0, end))); buffer = buffer.slice(end + 1); }
  });
  return { socket, frames, send: (value) => socket.write(JSON.stringify(value) + "\n") };
}
