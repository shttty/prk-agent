import type { SocketConnectionContext } from "../socket-state.ts";
import { send } from "../protocol/send.ts";
import { object } from "../../../gateway/wire/is-record.ts";
import { TERMINAL_SOCKET_FINAL } from "../protocol/terminal-protocol.ts";

export const terminalEvent = (ctx: SocketConnectionContext, value: unknown) => {
        send(ctx, value as object);
        if (object(value) && value.type === "closed") ctx.socket.close(TERMINAL_SOCKET_FINAL);
      };
