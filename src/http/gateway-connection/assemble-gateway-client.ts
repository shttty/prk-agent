import type { ClientContext } from "./client-state.ts";
import type { WebGatewayConnection } from "./client-types.ts";
import { available } from "./control-connection/available.ts";
import { streamCount } from "./stream-capacity/stream-count.ts";
import { call } from "./call-gateway.ts";
import { openTerminalSession } from "../terminal-client/open-terminal-session.ts";
import { observeStream } from "../observation-client/observe-stream.ts";
import { uploadFile } from "./push-upload.ts";
import { downloadFile } from "./pull-download.ts";
import { closeClient } from "./lifecycle/close.ts";

export function assembleGatewayClient(ctx: ClientContext): WebGatewayConnection {
  return {
    available: () => available(ctx),
    streamCount: () => streamCount(ctx),
    call: (method, params) => call(ctx, method, params),
    uploadFile: (params, signal, source) => uploadFile(ctx, params, signal, source),
    downloadFile: (params, signal, sink) => downloadFile(ctx, params, signal, sink),
    terminalSession: (sessionId, name, sink, generation) => openTerminalSession(ctx, sessionId, name, sink, generation),
    observeSessions: (sink) => observeStream(ctx, undefined, sink),
    observe: (sessionId, sink) => observeStream(ctx, sessionId, sink),
    close: () => closeClient(ctx),
  };
}
