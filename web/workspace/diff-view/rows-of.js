import { parseDiff } from "../../chat/tool-text/parse-diff.js";
import { parseUnifiedDiff } from "./parse-unified-diff.js";
export function rowsOf(reply) {
  if (!reply?.text) return null;
  return reply.kind === "agent" ? parseDiff(reply.text) : parseUnifiedDiff(reply.text);
}
