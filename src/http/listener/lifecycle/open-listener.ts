import type { ListenerContext } from "../listener-state.ts";
import { closeListener } from "./close-listener.ts";
import { isIP } from "node:net";

export async function openListener(ctx: ListenerContext): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      ctx.server.once("error", reject);
      ctx.server.listen(ctx.port, ctx.host, () => {
        ctx.server.removeListener("error", reject);
        resolve();
      });
    });
  } catch (error: unknown) {
    ctx.stopping = true;
    for (const response of ctx.responses) response.destroy();
    throw error;
  }

  const address = ctx.server.address();
  if (!address || typeof address === "string") {
    await closeListener(ctx);
    throw new Error("Web listener address was unavailable.");
  }
  const hostForUrl = isIP(ctx.host) === 6 ? `[${ctx.host}]` : ctx.host;
  ctx.origin = new URL(`http://${hostForUrl}:${address.port}`).origin;
  ctx.authority = new URL(ctx.origin).host;
 ctx.server.on("error", () => { void closeListener(ctx).catch(() => { }); });

}
