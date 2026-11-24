import { Value } from "typebox/value";
import { WireError } from "../../../gateway/wire/create-error.ts";
import { MEMORY_ENTRY_DELIMITER } from "../memory-constants.ts";
import { MEMORY_REQUEST_SCHEMA } from "../memory-schema.ts";
import type { MemoryOperation } from "../memory-types.ts";

export function validateOperations(request: unknown): MemoryOperation[] {
  if (!Value.Check(MEMORY_REQUEST_SCHEMA, request)) {
    throw new WireError("INVALID_REQUEST", "Invalid memory request: supply a non-empty operations array of {target, action, content?, old_text?}. No operations were applied.");
  }
  return request.operations.map(({ target, action, content, old_text }, index) => {
    function invalid(reason: string): never {
      throw new WireError("INVALID_REQUEST", `memory operations[${index}] ${action} ${reason}. No operations were applied.`);
    }
    if (action === "remove") {
      if (old_text === undefined) return invalid("requires old_text");
      if (content !== undefined) return invalid("does not accept content");
      return { target, action, old_text };
    }
    if (content === undefined) return invalid("requires content");
    const entry = content.trim();
    if (entry.includes(MEMORY_ENTRY_DELIMITER)) return invalid("content cannot contain the entry delimiter (newline, §, newline)");
    if (action === "add") {
      if (old_text !== undefined) return invalid("does not accept old_text");
      return { target, action, content: entry };
    }
    if (old_text === undefined) return invalid("requires old_text");
    return { target, action, content: entry, old_text };
  });
}
