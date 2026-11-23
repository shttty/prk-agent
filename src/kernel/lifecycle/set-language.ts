import type { KernelContext } from "../kernel-state.ts";
import type { KernelConfiguration, KernelLanguage, KernelLanguageChange } from "../kernel-types.ts";
import { WireError } from "../../gateway/wire/create-error.ts";
import { stop } from "../process/stop.ts";
import { publish } from "../telemetry/publish.ts";

export async function setLanguage(ctx: KernelContext, language: KernelLanguage, prepare: () => Promise<KernelConfiguration["bun"]>, persist: () => void): Promise<KernelLanguageChange> {
  if (ctx.closed || ctx.handoff || ctx.preparingHandoff || ctx.changingLanguage || ctx.starting || ctx.replacing || ctx.maintenance || ctx.cells.size || ctx.pendingFinished.size) {
    throw Object.assign(new WireError("BUSY", "Kernel language can only change while the kernel is idle."), { transient: true });
  }
  if (ctx.snapshot.language === language) return { status: "unchanged", language, variablesLost: false };
  ctx.changingLanguage = true;
  try {
    const bun = await prepare();
    if (ctx.closed || ctx.handoff) throw new WireError("UNAVAILABLE", "Kernel closed or changed owner during the language check.");
    const previous = ctx.process;
    if (previous) await stop(ctx, previous, { cause: "replace" });
    if (ctx.closed || ctx.handoff) throw new WireError("UNAVAILABLE", "Kernel closed or changed owner before saving the language.", previous && { closed: true, variablesLost: true });
    try { persist(); }
    catch (error) {
      throw new WireError("UNAVAILABLE", `Could not save kernel language: ${String(error)}`, { ...(previous && { closed: true, variablesLost: true }) });
    }
    ctx.configuration = { ...ctx.configuration, bun };
    ctx.process = undefined;
    ctx.helperNames = [];
    ctx.namespaceAfterCompaction = false;
    ctx.snapshot = { state: "not_started", language, activeCells: [] };
    publish(ctx, {});
    return { status: "changed", language, variablesLost: previous !== undefined };
  } finally { ctx.changingLanguage = false; }
}
