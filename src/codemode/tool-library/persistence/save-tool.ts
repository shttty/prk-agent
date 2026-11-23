import type { ToolLibraryContext } from "../library-state.ts";
import type { StoredTool, ToolSource, ToolLibraryEntry } from "../library-types.ts";
import { time } from "../curation/read-time.ts";
import { transition } from "../curation/transition-tool.ts";
import { bound } from "../curation/enforce-capacity.ts";
import { publish } from "../observation/publish-library.ts";
import { age } from "../curation/age-library.ts";
import { list } from "../catalog/list-tools.ts";
import { WireError } from "../../../gateway/wire/create-error.ts";

export function save(ctx: ToolLibraryContext, source: ToolSource): ToolLibraryEntry {
  if (typeof source.reason !== "string" || !source.reason.trim()) throw new WireError("INVALID_REQUEST", "Persisted tools require a nonblank reason describing future tasks that will reuse them.");
  age(ctx);
  const previous = ctx.records.filter((record) => record.name === source.name).sort((a, b) => b.version - a.version)[0];
  const manual = previous?.manual === true;
  for (const record of ctx.records.filter((item) => item.name === source.name && item.status !== "archived")) transition(ctx, record, "archived");
  const now = time(ctx);
  const record: StoredTool = { ...source, reason: source.reason.trim(), imports: [...source.imports], version: (previous?.version ?? 0) + 1, status: manual ? "promoted" : "staging", manual, promotionReady: false,
    sessions: [...(previous?.sessions ?? [])], successfulCalls: previous?.successfulCalls ?? 0, createdAt: now, changedAt: now, ...(previous?.lastUsedAt ? { lastUsedAt: previous.lastUsedAt } : {}) };
  ctx.records.push(record);
  bound(ctx); publish(ctx);
  return list(ctx).find((item) => item.name === record.name && item.version === record.version)!;
}
