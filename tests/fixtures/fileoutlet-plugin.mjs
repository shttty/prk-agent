import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const names = { "metadata.txt": true, "replacement-read.txt": true, "blocked.txt": true, "mutate.txt": true, "diagnosed.txt": true, "formatted.txt": true, "large.txt": true, "direct.txt": true, "local.txt": true };

export default function fileoutletFixture(pi) {
  const record = (ctx, entry) => appendFileSync(join(ctx.cwd, "fileoutlet-events.jsonl"), JSON.stringify({ pid: process.pid, cwd: ctx.cwd, ...entry }) + "\n");
  pi.on("tool_call", (event, ctx) => {
    if (!["read", "edit", "write"].includes(event.toolName) || !names[basename(event.input.path ?? "")]) return;
    const input = structuredClone(event.input);
    const name = basename(input.path);
    if (event.toolName === "edit" && name === "mutate.txt") event.input.edits[0].newText = "MUTATED_BY_PLUGIN\n";
    record(ctx, { phase: "tool_call", toolName: event.toolName, toolCallId: event.toolCallId, input, executedInput: event.input });
    if (event.toolName === "edit" && name === "blocked.txt") return { block: true, reason: "FILEOUTLET_EDIT_DENIED" };
  });
  pi.on("tool_result", (event, ctx) => {
    if (!["read", "edit", "write"].includes(event.toolName) || !names[basename(event.input.path ?? "")]) return;
    const name = basename(event.input.path);
    let formatted = false;
    if (!event.isError && event.toolName === "edit" && name === "formatted.txt"
      && event.input.edits.some((edit) => edit.newText.includes("UNFORMATTED_BY_MODEL"))) {
      const path = resolve(ctx.cwd, event.input.path);
      const current = readFileSync(path, "utf8");
      if (!current.includes("UNFORMATTED_BY_MODEL")) throw new Error("Formatter did not observe the native write");
      writeFileSync(path, "FORMATTED_BY_PLUGIN\nstable\n");
      formatted = true;
    }
    record(ctx, { phase: "tool_result", toolName: event.toolName, toolCallId: event.toolCallId, input: event.input,
      content: event.content, details: event.details, isError: event.isError, formatted });
    if (name === "replacement-read.txt" && event.toolName === "read") return { content: [{ type: "text", text: "FILEOUTLET_READ_REPLACEMENT" }] };
    const diagnostic = name === "metadata.txt" && event.toolName === "read" ? "FILEOUTLET_READ_DIAGNOSTIC"
      : name === "diagnosed.txt" && event.toolName === "edit" ? "FILEOUTLET_EDIT_DIAGNOSTIC"
      : formatted ? "FILEOUTLET_FORMAT_DIAGNOSTIC" : undefined;
    if (diagnostic) return { content: [...event.content, { type: "text", text: diagnostic }] };
  });
}
