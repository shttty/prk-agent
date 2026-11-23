import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { GenerationContext } from "../generation-types.ts";
import { encode } from "../../codec/encode.mjs";
import { send } from "../connection/send-frame.ts";
import { fail } from "../lifecycle/fail.ts";
import { errorOf } from "../connection/normalize-error.ts";

export function forwardReverseUpdate(ctx: GenerationContext, id: string, partial: AgentToolResult<unknown>): void {
  void send(ctx, { kind: "update", id, payload: encode(partial) }).catch((error) => fail(ctx, errorOf(error)));
}
