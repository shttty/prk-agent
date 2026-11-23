import { defineTool } from "@earendil-works/pi-coding-agent";
import type { FilesContext } from "./file-types.ts";
import { execute } from "./execute-operation.ts";
import { resultRenderer } from "./render-result.ts";
import { readSchema } from "./file-schema.ts";
import { renderReadCall } from "./render-read-call.ts";
export function createRead(ctx: FilesContext) {
  return defineTool({
      name: "read",
      label: "Read target file",
      description: "Read a page of a UTF-8 text file on the target machine. Offset is 1-based; returns at most 2000 lines and 50 KiB. Bare CR remains content. Kernel-nested reads emit a plugin notice only: the kernel supplies that page to the model without transferring it through the Gateway.",
      promptSnippet: "Read a bounded page from a target-machine file",
      parameters: readSchema,
      async execute(id, input, signal) { return execute(ctx, "read", readSchema, id, input, signal); },
      renderCall: renderReadCall,
      ...resultRenderer,
  });
}
