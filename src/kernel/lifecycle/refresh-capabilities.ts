import type { KernelContext } from "../kernel-state.ts";
import { maintain } from "./maintain.ts";

export async function refreshCapabilities(ctx: KernelContext): Promise<void> {
  if (ctx.snapshot.language === "bun") return;
  if (ctx.process && !ctx.process.retired) await maintain(ctx, { kind: "library", entries: ctx.hooks.libraryEntries?.() ?? [] });
}
