import { capabilityEnabled } from "../capabilities/is-capability-enabled.ts";
import type { RuntimeContext } from "../runtime-state.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";

export function kernelCapabilities(ctx: RuntimeContext, name: string) {
  const files = ctx.helpers.some((helper) => helper.name === name && helper.module === "files");
  return (!files || (!localEnabled(ctx) && capabilityEnabled(ctx, "kernel:module:files")))
    && capabilityEnabled(ctx, `kernel:${name}`, "group:tools:kernel");
}
