import type { TargetTransport } from "../process-transport/transport-types.ts";
import type { TargetEvent } from "../channels/channel-types.ts";
import type { RuntimeLinkContext } from "./link-state.ts";
import type { RuntimeLink } from "./link-types.ts";
import { start } from "./connection/start.ts";
import { close } from "./connection/close.ts";
import { request } from "./requests/request.ts";
import { createProcessWindow } from "../../target-environment/process-window/assemble-window.ts";
import { parseProcessWindowLimits } from "../../target-environment/process-window/parse-limits.ts";
import type { ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";

/** Each run owns its framing and reply table: late output from an old pipe cannot settle a new request. */
export function runtimeLink(
  transport: TargetTransport,
  timeoutMs: number,
  onEvent: (event: TargetEvent) => void,
  onExit: (reason: string) => void,
  limits: ProcessWindowLimits = parseProcessWindowLimits(),
): RuntimeLink {
  const ctx: RuntimeLinkContext = {
    transport, timeoutMs, onEvent, onExit,
    handshake: Promise.withResolvers<void>(), replies: new Map(), stage: "ready", pending: "", nextId: 0,
    limits, window: createProcessWindow(limits),
    exited: undefined, closing: undefined, startTimer: undefined,
  };
  return {
    request: (mod, op, args, signal) => request(ctx, mod, op, args, signal),
    close: () => close(ctx),
    start: (command, signal) => start(ctx, command, signal),
  };
}
