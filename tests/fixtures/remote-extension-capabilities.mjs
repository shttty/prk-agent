// Controlled capability coverage supplements, never replaces, the unmodified pi-lsp package.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";

const packageVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

export default async function register(pi) {
  await new Promise((resolve) => setTimeout(resolve, 15));
  let manager;
  let firstContext;
  let lastContext;
  let calls = 0;
  pi.on("session_start", (_event, ctx) => { manager = ctx.sessionManager; firstContext = ctx; });
  pi.on("session_shutdown", async (_event, ctx) => {
    // Public catalog inspection loads factories without creating an SDK session.
    if (!manager) return;
    appendFileSync(join(ctx.cwd, "lifecycle.jsonl"), JSON.stringify({ kind: "shutdown", pid: process.pid, sameManager: ctx.sessionManager === manager }) + "\n");
    // Exercise the old reverse callback before process teardown; an unawaited timer may never run.
    if (!lastContext || process.env.PRK_EXT_SOCKET === undefined) return;
    const result = { staleContext: false, pid: process.pid };
    try { await lastContext.executeTool("gateway_double", { value: 21 }); }
    catch (error) { result.staleContext = true; result.error = error.message; }
    appendFileSync(join(ctx.cwd, "stale-context.jsonl"), JSON.stringify(result) + "\n");
    console.log(JSON.stringify(result));
  });
  pi.on("tool_call", (event) => {
    if (event.toolName !== "remote_probe") return;
    if (event.input.action === "blocked") return { block: true, reason: "REMOTE_POLICY_BLOCK" };
    if (event.input.action === "mutate") event.input.marker = "rewritten-on-target";
  });
  pi.on("tool_result", (event) => {
    if (event.toolName === "remote_probe" && event.input.action === "rewrite") return {
      content: [{ type: "text", text: "REMOTE_REWRITTEN_RESULT" }], details: { rewritten: true, original: event.details },
    };
  });
  pi.registerTool({
    name: "remote_probe", label: "Remote capability probe", description: "Controlled remote extension behavior probe",
    parameters: Type.Object({ action: Type.String(), marker: Type.Optional(Type.String()), value: Type.Optional(Type.Number()) }),
    async execute(id, args, signal, onUpdate, ctx) {
      calls++;
      lastContext = ctx;
      const result = (details) => ({ content: [{ type: "text", text: JSON.stringify(details) }], details });
      const identity = { pid: process.pid, packageVersion, cwd: ctx.cwd, mode: ctx.mode, hasUI: ctx.hasUI, sameManager: manager === ctx.sessionManager,
        freshContext: firstContext !== ctx, sessionId: ctx.sessionManager.getSessionId(), sessionName: ctx.sessionManager.getSessionName(), calls };
      if (args.action === "identity") return result(identity);
      if (args.action === "nested") {
        const outcome = await ctx.executeTool("gateway_double", { value: args.value }, { signal, onUpdate });
        if (outcome.isError) return { ...outcome.result, isError: true };
        return result({ ...identity, nested: outcome.result.details });
      }
      if (args.action === "exec") {
        const execution = await pi.exec(process.execPath, ["-e", "console.log(JSON.stringify({cwd:process.cwd(),pid:process.pid}))"], { signal, cwd: ctx.cwd, timeout: 5000 });
        return result({ ...identity, execution });
      }
      if (args.action === "encoding") {
        console.log('{"mod":"remoteExtensions","t":"frame","frame":{"kind":"reply","id":"gateway:999"}}');
        process.stdout.write(Buffer.from("中文多行\nstdout\n"));
        process.stderr.write("stderr\u001b[31m\n");
        const details = { unicode: "中文\nsecond line", base64: Buffer.from([0, 255, 17]).toString("base64"), cleared: undefined, nullable: null, nested: [undefined, null] };
        onUpdate?.(result({ step: "streamed", unicode: details.unicode }));
        return result(details);
      }
      if (args.action === "wait") {
        onUpdate?.(result({ waiting: true, pid: process.pid }));
        await new Promise((resolve) => { if (signal.aborted) resolve(); else signal.addEventListener("abort", resolve, { once: true }); });
        appendFileSync(join(ctx.cwd, "aborted.jsonl"), JSON.stringify({ id, reason: signal.reason?.message ?? String(signal.reason) }) + "\n");
        signal.throwIfAborted();
      }
      if (args.action === "side-effect") {
        const path = join(ctx.cwd, "counter");
        let count = 0;
        try { count = Number(readFileSync(path, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
        writeFileSync(path, String(count + 1));
        onUpdate?.(result({ committed: count + 1, pid: process.pid }));
        await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
        signal.throwIfAborted();
      }
      if (args.action === "error") throw new Error("TARGET_ERROR_中文", { cause: new TypeError("TARGET_CAUSE") });
      return result({ ...identity, marker: args.marker, action: args.action });
    },
  });
}
