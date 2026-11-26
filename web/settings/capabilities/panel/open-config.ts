import type { CapabilityCtx, CapabilityGroup } from "../capability-types.ts";

export function openConfig(ctx: Pick<CapabilityCtx, "hidePeek" | "setConfig" | "setWritten" | "setError" | "callConfig">, item: CapabilityGroup) {
  const { hidePeek, setConfig, setWritten, setError, callConfig } = ctx;
  hidePeek(); setConfig({ id: item.id, open: true }); setWritten(null); setError("");
  if (item.id !== "group:tools:package:<inline:terminals>") void callConfig(item.id, "get", { provider: item.name });
}
