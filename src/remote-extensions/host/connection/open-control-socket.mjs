import { once } from "node:events";
import { isAbsolute } from "node:path";
import { createConnection } from "node:net";
import { createInterface } from "node:readline";

export async function openControlSocket(ctx) {
  const socketPath = process.env.PRK_EXT_SOCKET;
  if (typeof socketPath !== "string" || !isAbsolute(socketPath)) throw new Error("PRK_EXT_SOCKET must name an absolute Unix socket path");
  ctx.socket = createConnection({ path: socketPath });
  await once(ctx.socket, "connect");
  ctx.socket.write(`${JSON.stringify({ pid: process.pid, rootPid: process.ppid, scope: process.env.PRK_EXT_SCOPE_PATH ?? null })}\n`);
  ctx.lines = createInterface({ input: ctx.socket, crlfDelay: Infinity });
}
