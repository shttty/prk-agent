import type { SessionHost } from "../../../sessions/host/host-types.ts";
import { WireError } from "../../wire/create-error.ts";
import type { HostBindingContext } from "../host-binding-state.ts";

export function requireSource(ctx: HostBindingContext): SessionHost {
  ctx.binding.refresh();
  if (!ctx.source) throw new WireError("NOT_FOUND", "Session has no active runtime; only intentionally sleeping sessions wake on new input.");
  return ctx.source;
}
