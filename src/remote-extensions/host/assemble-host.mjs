import { fileURLToPath } from "node:url";
import { assertLive } from "./assert-live.mjs";
import { assertRunning } from "./assert-running.mjs";
import { facade } from "../sdk-facade/create-facade.mjs";
import { warning } from "../sdk-facade/warn-capability.mjs";
import { uiContext } from "../ui/create-ui-context.mjs";
import { reverseRequest } from "./request-gateway.mjs";
import { disconnect } from "./disconnect.mjs";

export function assembleHost() {
  /** @type {import("./host-types.ts").HostContext} */
  const ctx = {
    reverse: new Map(), active: new Map(), incoming: new Set(), warned: new Set(),
    sequence: 0, generation: undefined, loadAttempted: false, shutdownPromise: undefined,
    memoryTelemetry: undefined, connected: true, socket: undefined, lines: undefined,
    sourceDirectory: fileURLToPath(new URL("../", import.meta.url)),
    // Keep the original bundle-root resolution anchor; this URL is not a compatibility module.
    sourceUrl: new URL("../host.mjs", import.meta.url).href,
    assertLive: undefined,
    assertRunning: undefined,
    facade: undefined,
    warning: undefined,
    uiContext: undefined,
    reverseRequest: undefined,
    disconnect: undefined,
  };
  ctx.assertLive = assertLive.bind(undefined, ctx);
  ctx.assertRunning = assertRunning.bind(undefined, ctx);
  ctx.facade = facade.bind(undefined, ctx);
  ctx.warning = warning.bind(undefined, ctx);
  ctx.uiContext = uiContext.bind(undefined, ctx);
  ctx.reverseRequest = reverseRequest.bind(undefined, ctx);
  ctx.disconnect = disconnect.bind(undefined, ctx);
  return ctx;
}
