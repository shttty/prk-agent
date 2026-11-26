import { parseDiff } from "../../chat/tool-text/parse-diff.js";
import type { DiffReply } from "../file-editor/editor-types.ts";
import { parseUnifiedDiff } from "./parse-unified-diff.ts";
export function rowsOf(reply: DiffReply | null | undefined) {
  if (!reply?.text) return null;
  return reply.kind === "agent" ? parseDiff(reply.text) : parseUnifiedDiff(reply.text);
}
