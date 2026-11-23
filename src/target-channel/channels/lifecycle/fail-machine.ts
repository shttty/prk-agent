import { targetConnectionError } from "../../connection-error/classify-target-connection-error.ts";
import { errorOf } from "../../connection-error/normalize-error.ts";
import type { ChannelsContext } from "../channel-state.ts";
import type { MachineRecord } from "../channel-types.ts";
import { teardown } from "./retire-generation.ts";
import { publish } from "../state/publish-state.ts";

export function fail(ctx: ChannelsContext, machine: MachineRecord, cause: unknown): void {
  const { log } = ctx;
  const failure = targetConnectionError(cause, machine.id) ?? errorOf(cause);
  const reason = failure.message;
  const link = teardown(machine);
  void link?.close().catch(() => log(`target channel ${machine.id || "local"}: close failed`));
  machine.error = reason;
  machine.failure = failure;
  machine.state = "error";
  log(`target channel ${machine.id || "local"}: ${reason}`);
  publish(ctx, machine);
}
