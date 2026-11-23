import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

export async function writeHookPlugins({ root, home, agentDir, localEvents, observerEvents, remoteEvents, counter }) {
const prelude = (path) => `import { appendFileSync, existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
function record(event, ctx, extra = {}) {
  appendFileSync(${JSON.stringify(path)}, JSON.stringify({ event, pid: process.pid, sessionId: ctx.sessionManager.getSessionId(), ...extra }) + "\\n");
}
function observeAbort(ctx, token) {
  ctx.signal?.addEventListener("abort", () => record("abort", ctx, { token }), { once: true });
}
async function lateResult(event, ctx, location) {
  const token = event.input.token;
  record("result-enter", ctx, { token, location, phase: event.details.phase });
  observeAbort(ctx, token);
  while (!existsSync(${JSON.stringify(root)} + "/release-" + token)) await delay(20, undefined, { ref: false });
  record("late-return", ctx, { token, location });
  return { content: [{ type: "text", text: "HOOK_STOP_LATE_" + token }], details: { token, phase: "late" } };
}
`;

  await mkdir(join(agentDir, "extensions"), { recursive: true });
  await writeFile(join(agentDir, "extensions", "hook-stop-local.js"), prelude(localEvents) + `
export default function(pi) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "hook_probe" || event.input.mode !== "local-never") return;
    record("call-enter", ctx, { token: event.input.token });
    observeAbort(ctx, event.input.token);
    await new Promise(() => {});
  });
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName === "hook_probe" && event.input.mode === "local-result-late") return lateResult(event, ctx, "local");
  });
}
`);
  // This separate local plugin must keep receiving normal hooks after either hung plugin is stopped.
  await writeFile(join(agentDir, "extensions", "hook-stop-observer.js"), prelude(observerEvents) + `
export default function(pi) {
  for (const type of ["tool_call", "tool_result"]) pi.on(type, (event, ctx) => {
    if (event.toolName === "hook_probe") record(type, ctx, { token: event.input.token });
  });
}
`);
  const { ArtifactStore } = await import("../../../src/artifacts/store/assemble-store.ts");
  const { buildRemoteExtensionPackage } = await import("../../../src/remote-extensions/bundle/build-extension-package.ts");
  const source = join(root, "remote-plugin");
  await mkdir(source);
  await writeFile(join(source, "package.json"), JSON.stringify({ name: "@prk-tests/hook-stop", version: "1.0.0", private: true,
    type: "module", files: ["index.js"], pi: { extensions: ["./index.js"] } }));
  await writeFile(join(source, "index.js"), prelude(remoteEvents) + `
export default function(pi) {
  pi.on("session_start", (_event, ctx) => record("session_start", ctx, { sessionFile: ctx.sessionManager.getSessionFile() }));
  pi.on("tool_call", (event, ctx) => {
    if (event.toolName === "hook_probe") record("other-handler", ctx, { token: event.input.token });
  });
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "hook_probe") return;
    const { mode, token } = event.input;
    if (!["remote-never", "remote-frozen", "remote-slow"].includes(mode)) return;
    record("call-enter", ctx, { token, mode });
    observeAbort(ctx, token);
    if (mode === "remote-frozen") {
      appendFileSync(${JSON.stringify(counter)}, JSON.stringify({ token, pid: process.pid }) + "\\n");
      while (true) {}
    }
    if (mode === "remote-never") await new Promise(() => {});
    else { await delay(6000); record("slow-completed", ctx, { token }); }
  });
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName === "hook_probe" && event.input.mode === "remote-result-late") return lateResult(event, ctx, "remote");
  });
  pi.registerTool({ name: "hook_probe", label: "Hook stop fixture", description: "Return owned machine-readable fixture evidence.",
    parameters: { type: "object", properties: { mode: { type: "string" }, token: { type: "string" } }, required: ["mode", "token"] },
    async execute(_id, { mode, token }, _signal, _update, ctx) {
      record("execute", ctx, { mode, token });
      return { content: [{ type: "text", text: "HOOK_STOP_ORIGINAL_" + token }], details: { token, phase: "original", pid: process.pid } };
    } });
}
`);
  const packed = JSON.parse((await promisify(execFile)("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", root], {
    cwd: source, env: { ...process.env, NODE_ENV: "development" }, maxBuffer: 4 * 1024 * 1024,
  })).stdout);
  assert.equal(packed.length, 1);
  const pkg = await buildRemoteExtensionPackage({ store: new ArtifactStore(join(home, "assets")), source: join(root, packed[0].filename) });

await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source, enabled: true, location: "host" }], compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" }));
return { ...pkg, source };
}
