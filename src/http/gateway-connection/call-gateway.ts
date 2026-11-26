import type { ClientContext } from "./client-state.ts";
import type { Method } from "../../gateway/wire/wire-types.ts";
import { ensureControl } from "./control-connection/ensure-control.ts";
import { DEFAULT_HTTP_OPTIONS } from "../../config/http/http-options.ts";

export async function call(ctx: ClientContext, method: Method, params: Record<string, unknown>): Promise<unknown> {
    const client = await ensureControl(ctx);
    try {
      // Both wait on work that may outlast the control timeout: an install, or an in-flight send a status query waits for.
      const long = method === "pluginsInstall" || method === "sendStatus";
      const result = await client.request(method, params, long ? Math.max(ctx.gateway.requestTimeoutMs, (ctx.options.http ?? DEFAULT_HTTP_OPTIONS).requestTimeoutMs) : ctx.gateway.requestTimeoutMs);
      ctx.reachable = true;
      return result;
    } catch (error: unknown) {
      if (client.lost) ctx.reachable = false;
      throw error;
    }
  }
