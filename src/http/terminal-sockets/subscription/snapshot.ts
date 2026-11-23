import type { SocketConnectionContext } from "../socket-state.ts";
import { send } from "../protocol/send.ts";
import { object } from "../../../gateway/wire/is-record.ts";

export const terminalSnapshot = (ctx: SocketConnectionContext, value: unknown) => send(ctx, { type: "snapshot", ...(object(value) ? value : {}) });
