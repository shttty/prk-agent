import type { SessionEntry } from "@earendil-works/pi-coding-agent";
import type { FileEdit } from "./agent-edits-types.ts";
import { isObject } from "./is-object.ts";
import { writeDiff } from "./write-diff.ts";

export function fileEdits(entries: readonly SessionEntry[]): FileEdit[] {
  const calls = new Map<string, { name: string; args: Record<string, unknown> }>();
  const edits: FileEdit[] = [];
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const message = entry.message;
    if (message.role === "assistant") {
      for (const part of message.content) {
        if (part.type === "toolCall" && (part.name === "edit" || part.name === "write")) calls.set(part.id, { name: part.name, args: part.arguments });
      }
    } else if (message.role === "toolResult" && !message.isError) {
      const call = calls.get(message.toolCallId);
      const path = call?.args.path;
      if (!call || typeof path !== "string" || path.length === 0) continue;
      if (call.name === "edit") {
        const diff = isObject(message.details) ? message.details.diff : undefined;
        if (typeof diff !== "string") continue;
        const rows = diff.split("\n");
        edits.push({ path, diff, added: rows.filter((row) => row.startsWith("+")).length, removed: rows.filter((row) => row.startsWith("-")).length });
      } else if (typeof call.args.content === "string") {
        const diff = writeDiff(call.args.content);
        edits.push({ path, diff, added: diff === "" ? 0 : diff.split("\n").length, removed: 0 });
      }
    }
  }
  return edits;
}
