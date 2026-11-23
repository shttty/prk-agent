import { Value } from "typebox/value";
import { WireError } from "../../../gateway/wire/create-error.ts";
import type { MemoryStoreContext, MemoryContext, MemoryResult, MemoryOperation, FileEdit } from "../memory-types.ts";
import { MEMORY_REQUEST_SCHEMA } from "../memory-schema.ts";
import { MEMORY_ENTRY_DELIMITER } from "../memory-constants.ts";
import { readStoreSettings } from "../layers/read-store-settings.ts";
import { plan } from "./plan-operations.ts";
import { commit } from "./commit-files.ts";
import { usage as measureUsage } from "../capacity/measure-usage.ts";

export function apply(ctx: MemoryStoreContext, request: unknown, context: MemoryContext): MemoryResult {
  if (!ctx.enabled && context.source !== "human") throw new WireError("INVALID_REQUEST", "Memory is disabled.");
  if (!Value.Check(MEMORY_REQUEST_SCHEMA, request)) {
    throw new WireError("INVALID_REQUEST", "Invalid memory request. Supply one {target,action,content?,old_text?} or a non-empty operations array; add/replace require content and replace/remove require old_text.");
  }
  const settings = readStoreSettings(ctx);
  const operations: MemoryOperation[] = ("operations" in request ? request.operations : [request]).map((operation) => {
    const content = operation.content?.trim();
    if (content?.includes(MEMORY_ENTRY_DELIMITER)) throw new WireError("INVALID_REQUEST", "A memory entry cannot contain the entry delimiter (newline, §, newline). No operations were applied.");
    return { ...operation, ...(content === undefined ? {} : { content }) };
  });
  const planned = plan(settings, operations, context);
  const edits = new Map<string, FileEdit>();
  for (const document of planned.documents) {
    edits.set(document.path, { before: document.raw, after: document.entries.join(MEMORY_ENTRY_DELIMITER) });
  }
  commit(edits);
  const usage = planned.documents.map((document) => measureUsage(document.layer, document.entries, context));
  return { usage, changes: planned.changes, message: "Saved; do not repeat this update." + (usage.some((item) => item.soft && item.overLimit) ? ` ${usage.filter((item) => item.soft && item.overLimit).map((item) => item.target).join(", ")} exceeds its recommended size; this is a reminder, not a hard limit.` : "") };
}
