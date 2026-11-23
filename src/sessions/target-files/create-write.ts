import { defineTool } from "@earendil-works/pi-coding-agent";
import type { FilesContext } from "./file-types.ts";
import { execute } from "./execute-operation.ts";
import { resultRenderer } from "./render-result.ts";
import { writeSchema } from "./file-schema.ts";
import { renderWriteCall } from "./render-write-call.ts";
export function createWrite(ctx: FilesContext) {
  return defineTool({
      name: "write",
      label: "Write target file",
      description: "Atomically write UTF-8 content to a target-machine file, creating missing parent directories. Existing files retain their BOM, first newline style and permissions; bare CR is content. New files retain the supplied content's BOM and newlines. Requests are limited to 1 MiB, editable files to 200 MiB and results to 256 KiB; limits are checked before mutation. Live local Vim/Emacs locks reject writes.",
      promptSnippet: "Atomically write a target-machine file",
      parameters: writeSchema,
      async execute(id, input, signal) { return execute(ctx, "write", writeSchema, id, input, signal); },
      renderCall: renderWriteCall,
      ...resultRenderer,
  });
}
