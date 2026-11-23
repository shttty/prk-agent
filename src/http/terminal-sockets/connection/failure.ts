import type { SocketConnectionContext } from "../socket-state.ts";
import { send } from "../protocol/send.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export const terminalFailure = (ctx: SocketConnectionContext, error: unknown) => send(ctx, error instanceof WireError
        ? { type: "error", code: error.code, message: error.message }
        : { type: "error", code: "HOST_ERROR", message: "Terminal operation failed; inspect the terminal state." });
