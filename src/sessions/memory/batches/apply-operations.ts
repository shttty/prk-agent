import { WireError } from "../../../gateway/wire/create-error.ts";
import type { MemoryStoreContext, MemoryContext, MemoryResult, FileEdit } from "../memory-types.ts";
import { validateOperations } from "./validate-operations.ts";
import { MEMORY_ENTRY_DELIMITER } from "../memory-constants.ts";
import { readStoreSettings } from "../layers/read-store-settings.ts";
import { plan } from "./plan-operations.ts";
import { commit } from "./commit-files.ts";
import { usage as measureUsage } from "../capacity/measure-usage.ts";

export function apply(ctx: MemoryStoreContext, request: unknown, context: MemoryContext): MemoryResult {
  if (!ctx.enabled && context.source !== "human") throw new WireError("INVALID_REQUEST", "Memory is disabled.");
  const operations = validateOperations(request);
  const settings = readStoreSettings(ctx);
  const planned = plan(settings, operations, context);
  const edits = new Map<string, FileEdit>();
  for (const document of planned.documents) {
    edits.set(document.path, { before: document.raw, after: document.entries.join(MEMORY_ENTRY_DELIMITER) });
  }
  commit(edits);
  const usage = planned.documents.map((document) => measureUsage(document.layer, document.entries, context));
  return { usage, changes: planned.changes, message: "Saved; do not repeat this update." + (usage.some((item) => item.soft && item.overLimit) ? ` ${usage.filter((item) => item.soft && item.overLimit).map((item) => item.target).join(", ")} exceeds its recommended size; this is a reminder, not a hard limit.` : "") };
}
