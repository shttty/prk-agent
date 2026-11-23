import { Buffer } from "node:buffer";
import type { TSchema } from "typebox";
import { Value } from "typebox/value";
import type { FilesContext, FileOperation } from "./file-types.ts";
import { nestedCall, KERNEL_READ_NOTICE } from "./file-protocol.ts";
import FILE_LIMITS from "../../target-channel/target-files/file-limits.json" with { type: "json" };
import { resultSchema } from "./file-schema.ts";
export async function execute(ctx: FilesContext, op: FileOperation, schema: TSchema, id: string, input: Record<string, unknown>, signal?: AbortSignal) {
    // SDK validation precedes tool_call hooks; validate again after hooks can mutate input.
    if (!Value.Check(schema, input)) throw new Error(`Invalid ${op} arguments after tool hooks.`);
    const request = { ...input, cwd: ctx.cwd };
    if (Buffer.byteLength(JSON.stringify(request), "utf8") > FILE_LIMITS.MAX_REQUEST_BYTES) throw new Error("File tool request exceeds 1 MiB; nothing written.");
    if (signal?.aborted) throw new Error("Operation aborted");
    if (op === "read" && nestedCall.test(id)) {
      return { content: [{ type: "text" as const, text: KERNEL_READ_NOTICE }], details: {} };
    }
    const reply = await ctx.lease().request("files", op, request);
    if (!Value.Check(resultSchema, reply)) throw new Error(`Invalid target ${op} result.`);
    const result = { content: reply.content, details: reply.details };
    if (Buffer.byteLength(JSON.stringify(result), "utf8") > FILE_LIMITS.MAX_RESULT_BYTES) throw new Error("File tool result exceeds 256 KiB.");
    if (op === "read" && result.content.reduce((size, part) => size + Buffer.byteLength(part.text, "utf8"), 0) > FILE_LIMITS.MAX_READ_BYTES) {
      throw new Error("Target read result exceeds 50 KiB.");
    }
    if (op !== "read" && !result.details.hash) throw new Error(`Target ${op} result has no written-file hash.`);
    if (op === "edit" && (result.details.diff === undefined || result.details.patch === undefined)) {
      throw new Error("Target edit result has no diff or patch.");
    }
    return result;
  }
