import { DEFAULT_GATEWAY_OPTIONS, type GatewayOptions } from "../../config/gateway/gateway-options.ts";
import { DEFAULT_LIMITS_OPTIONS, type LimitsOptions } from "../../config/limits/limits-options.ts";
import { createConnection } from "node:net";
import { WireError } from "../wire/create-error.ts";
import { readFrames } from "../socket-channel/read-frames.ts";
import { validateSocketPath } from "../socket-endpoint/validate-socket-path.ts";
import type { ClientContext } from "./client-state.ts";
import { assembleClient } from "./assemble-client.ts";
import { disconnectClient } from "./connection/disconnect-client.ts";
import { openSocket } from "./connection/open-socket.ts";
import { receiveFrame } from "./protocol/receive-frame.ts";

export async function connectGateway(path: string, gateway: GatewayOptions = DEFAULT_GATEWAY_OPTIONS, limits: LimitsOptions = DEFAULT_LIMITS_OPTIONS) {
  if ([gateway.connectTimeoutMs, gateway.requestTimeoutMs].some((ms) => !Number.isSafeInteger(ms) || ms <= 0 || ms > 2_147_483_647)) throw new WireError("CLIENT_ERROR","Invalid request timeout.");
  validateSocketPath(path, limits);
  const socket = createConnection(path);
  const ctx: ClientContext = {
    socket, gateway, limits,
    closed: Promise.withResolvers<void>(),
    pending: new Map(),
    listeners: new Set(),
    collectionListeners: new Set(),
    terminalListeners: new Set(),
    counter: 0,
    lost: false,
  };
  const lose = () => disconnectClient(ctx);
  socket.on("error", lose);
  socket.once("close", lose);
  try {
    await openSocket(ctx);
  } catch (error) { lose(); throw error; }
  readFrames(socket, limits.outputBytes, (value) => receiveFrame(ctx, lose, value), lose);
  return assembleClient(ctx, lose);
}
