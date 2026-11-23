import type { ToolLibraryContext } from "../library-state.ts";
import { transition } from "./transition-tool.ts";
import { score } from "./rank-tool.ts";

export function bound(ctx: ToolLibraryContext): void {
  const promoted = ctx.records.filter((item) => item.status === "promoted");
  const overflow = promoted.length - ctx.options.promoted.capacity;
  for (const record of promoted.filter((item) => !item.manual).sort((a, b) => score(ctx, a, b)).slice(0, Math.max(0, overflow))) transition(ctx, record, "staging");
  const staging = ctx.records.filter((item) => item.status === "staging").sort((a, b) => score(ctx, a, b));
  for (const record of staging.slice(0, Math.max(0, staging.length - ctx.options.staging.capacity))) transition(ctx, record, "archived");
  const names = new Set(ctx.records.map((record) => record.name));
  for (const name of names) {
    const versions = ctx.records.filter((record) => record.name === name).sort((a, b) => b.version - a.version);
    const keep = new Set(versions.slice(0, ctx.options.versionsKept));
    ctx.records = ctx.records.filter((record) => record.name !== name || keep.has(record));
  }
  const archived = ctx.records.filter((item) => item.status === "archived").sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt));
  const removed = new Set(archived.slice(0, Math.max(0, archived.length - ctx.options.archive.capacity)));
  ctx.records = ctx.records.filter((record) => !removed.has(record));
}
