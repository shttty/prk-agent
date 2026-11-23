// Standalone extension host: stdout/stderr are logs; only the Unix socket carries protocol.
import { assembleHost } from "./assemble-host.mjs";
import { openControlSocket } from "./connection/open-control-socket.mjs";
import { receive } from "./dispatch/receive-frame.mjs";
import { disconnect } from "./disconnect.mjs";

// Tree deviation: the real eager startup entry belongs to the public host layer, not connection/.
export async function startHost(ctx) {
  await openControlSocket(ctx);
  ctx.lines.on("line", (line) => {
    try { receive(ctx, JSON.parse(line)); } catch (error) { disconnect(ctx, error); }
  });
  ctx.socket.on("error", ctx.disconnect);
  ctx.socket.on("close", () => disconnect(ctx));
}

await startHost(assembleHost());
