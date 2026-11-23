import { appendFileSync, readlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { Type } from "typebox";

const nativeNames = { read: true, edit: true, write: true, bash: true, grep: true, find: true, ls: true };

export default function nativeRemoteFixture(pi) {
  const record = (ctx, entry) => appendFileSync(join(ctx.cwd, "native-remote-events.jsonl"), JSON.stringify({
    pid: process.pid, cwd: ctx.cwd, ...entry,
  }) + "\n");
  pi.on("session_start", (_event, ctx) => {
    record(ctx, { phase: "session_start", offline: process.env.PI_OFFLINE, path: process.env.PATH,
      basePath: process.env.PRK_NATIVE_TEST_BASE_PATH, networkNamespace: readlinkSync("/proc/self/ns/net") });
  });
  pi.on("tool_call", (event, ctx) => {
    if (!nativeNames[event.toolName]) return;
    const input = structuredClone(event.input);
    const name = basename(input.path ?? "");
    if (event.toolName === "edit" && name === "mutate.txt") event.input.edits[0].newText = "NATIVE_PLUGIN_MUTATED";
    record(ctx, { phase: "tool_call", toolName: event.toolName, toolCallId: event.toolCallId,
      parentToolCallId: event.parentToolCallId, input, executedInput: event.input });
    if (event.toolName === "edit" && name === "blocked.txt") return { block: true, reason: "NATIVE_PLUGIN_DENIED" };
  });
  pi.on("tool_result", (event, ctx) => {
    if (!nativeNames[event.toolName]) return;
    record(ctx, { phase: "tool_result", toolName: event.toolName, toolCallId: event.toolCallId,
      parentToolCallId: event.parentToolCallId, input: event.input, content: event.content,
      details: event.details, isError: event.isError });
    if (event.toolName === "edit" && basename(event.input.path ?? "") === "fuzzy.txt" && !event.isError) {
      return { content: [...event.content, { type: "text", text: "NATIVE_PLUGIN_RESULT_DIAGNOSTIC" }] };
    }
  });
  pi.registerTool({
    name: "native_fixture_read", label: "Native fixture nested read", exposure: "codemode",
    description: "Read the owned acceptance fixture through public ctx.executeTool.",
    parameters: Type.Object({ path: Type.String() }),
    async execute(_id, { path }, signal, _onUpdate, ctx) {
      const outcome = await ctx.executeTool("read", { path, limit: 1 }, { signal });
      if (outcome.isError) throw new Error(JSON.stringify(outcome.result));
      return outcome.result;
    },
  });
}
