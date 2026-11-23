import { defineTool } from "@earendil-works/pi-coding-agent";
import type { FilesContext } from "./file-types.ts";
import { execute } from "./execute-operation.ts";
import { resultRenderer } from "./render-result.ts";
import { editSchema } from "./file-schema.ts";
import { renderEditCall } from "./render-edit-call.ts";
export function createEdit(ctx: FilesContext) {
  return defineTool({
      name: "edit",
      label: "Edit target file",
      description: "Edit a UTF-8 file on the target machine using sequential exact replacements. Each oldText must match exactly once after earlier edits; CRLF is normalized to LF and a leading BOM is ignored for matching. No fuzzy matching; overlapping duplicate occurrences are ambiguous. Empty oldText is allowed only when the current file is empty. Bare CR is content. The file's BOM and first newline style are preserved. All edits succeed together via atomic replacement, or nothing is written. Requests are limited to 1 MiB, editable files to 200 MiB, and combined results/diff/patch to 256 KiB; oversized results are rejected before writing. Live local Vim/Emacs locks reject writes.",
      promptSnippet: "Apply sequential, unique exact-text replacements on the target machine",
      promptGuidelines: ["Each edits[].oldText matches the file after previous edits in this call. Keep oldText small but unique; there is no fuzzy matching."],
      parameters: editSchema,
      async execute(id, input, signal) { return execute(ctx, "edit", editSchema, id, input, signal); },
      renderCall: renderEditCall,
      ...resultRenderer,
  });
}
