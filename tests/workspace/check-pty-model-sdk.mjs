import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxToolCall } from "@earendil-works/pi-ai";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { createPtyTerminals } from "../../src/workspace/pty-terminals/assemble-terminals.ts";
import { createModelTerminals } from "../../src/workspace/model-terminals/create-terminals.ts";
import { assembleTerminalsPlugin } from "../../src/plugins/terminals/assemble-terminals-plugin.ts";
import { createSessionHost } from "../../src/sessions/host/assemble-host.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../src/config/workspace/workspace-options.ts";
import { DEFAULT_TERMINAL_OPTIONS } from "../../src/config/terminal/terminal-options.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../src/config/limits/limits-options.ts";

assert.equal(process.env.JUPYTER_URL, undefined); assert.equal(process.env.JUPYTER_TOKEN, undefined);
const root = await mkdtemp("/tmp/prk-S3-sdk-");
process.env.HOME = root; process.env.PRK_HOME = `${root}/prk`;
await mkdir(process.env.PRK_HOME);
const agentDir = `${root}/agent`; await mkdir(agentDir);
const manager = SessionManager.inMemory(root), sessionId = manager.getSessionId();
const envs = createTargetEnvironments({ resolve: () => ({ local: true }) });
const terminals = createPtyTerminals({ workspace: DEFAULT_WORKSPACE_OPTIONS, runtime: async () => ({ python: process.env.PI_TEST_PYTHON, basePython: process.env.PI_TEST_PYTHON, env: {} }), acquire: (id) => envs.acquire(id), ownerTarget: (id) => id === sessionId ? "owned" : undefined, onCleanupUnknown: (error) => console.error(error) });
const model = createModelTerminals({ sessionId, context: { cwd: root }, terminals, options: { ...DEFAULT_TERMINAL_OPTIONS, yieldMs: 1000, outputBytes: 256, commandOutputLimitBytes: 4096, truncatedHeadBytes: 256, truncatedTailBytes: 256, scrollbackLines: 1000, quietLadderMs: [200, 5000] }, limits: DEFAULT_LIMITS_OPTIONS });
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const results = new Map(), wakes = [];
let binding, session, host, userSubmissions = 0, answered = false;
async function until(read, label) {
  for (let n = 0; n < 1000; n++) { const value = await read(); if (value) return value; await delay(20); }
  throw new Error(`Native PTY SDK timeout: ${label}`);
}
try {
  const runtime = await ModelRuntime.create({ authPath: `${agentDir}/auth.json`, modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "s3-native-pty", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
  runtime.registerNativeProvider(provider.provider);
  provider.setResponses(Array.from({ length: 100 }, () => (context) => {
    const last = context.messages.at(-1);
    if (last?.role === "toolResult") { results.set(last.toolCallId, last); return fauxAssistantMessage("Observed real PTY result."); }
    const request = /^D7_TOOL (.+)$/s.exec(text(last));
    if (request) { const { id, name, args } = JSON.parse(request[1]); return fauxAssistantMessage(fauxToolCall(name, args, { id }), { stopReason: "toolUse" }); }
    const events = JSON.parse(text(last)).events;
    assert.ok(Array.isArray(events)); wakes.push(...events);
    if (!answered && events.some((event) => event.kind === "quiet" && event.result.command.includes("D7_WAIT"))) {
      answered = true;
      return fauxAssistantMessage(fauxToolCall("terminal_textsend", { name: "main", text: "y", yield_s: 0 }, { id: "quiet-answer" }), { stopReason: "toolUse" });
    }
    return fauxAssistantMessage("Observed native terminal event.");
  }));
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } });
  const loader = new DefaultResourceLoader({ cwd: root, agentDir, settingsManager, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [{ name: "terminals", factory: assembleTerminalsPlugin(model, { currentBinding: () => binding, setBinding: (value) => { binding = value; } }) }] });
  await loader.reload();
  ({ session } = await createAgentSession({ cwd: root, agentDir, modelRuntime: runtime, model: provider.getModel(), thinkingLevel: "off", resourceLoader: loader, settingsManager, sessionManager: manager, noTools: "all", tools: ["terminal_list", "terminal_textsend", "terminal_keysend", "terminal_read", "terminal_set", "terminal_close"] }));
  await session.bindExtensions({});
  host = createSessionHost({ session });
  async function call(name, args) {
    await until(() => host.getSnapshot().state === "idle", "SDK idle before request");
    const id = `request-${++userSubmissions}`;
    const turn = await host.submit({ requestId: id, message: `D7_TOOL ${JSON.stringify({ id, name, args })}` });
    assert.equal((await turn.completion).status, "completed");
    const result = results.get(id); assert.ok(result, `provider consumed ${name}`); assert.equal(result.isError, false, text(result));
    return JSON.parse(text(result));
  }
  if (!process.argv.includes("--output-only")) {
  const unicode = await call("terminal_textsend", { text: "printf '你😀\\n%.0s' {1..100}", yield_s: 1 });
  assert.equal(unicode.status, "done"); assert.equal(unicode.exit_code, 0);
  let recovered = "";
  while (Buffer.byteLength(recovered) < unicode.total_bytes) {
    const page = await call("terminal_read", { name: "main", command: unicode.command_id, offset: Buffer.byteLength(recovered) });
    assert.ok(page.output.length); recovered += page.output;
  }
  assert.equal(recovered, "你😀\n".repeat(100));
  console.log(JSON.stringify({ check: "native-tool-UTF8-paging", bytes: Buffer.byteLength(recovered), status: "PASS" }));
  for (const paste of [true, false]) {
    await call("terminal_textsend", { text: `bind 'set enable-bracketed-paste ${paste ? "on" : "off"}'`, yield_s: 1 });
    const multi = await call("terminal_textsend", { text: "printf 'MULTI_A\\n'\nprintf 'MULTI_B\\n'", yield_s: 1 });
    assert.equal(multi.exit_code, 0); assert.match(multi.output, /MULTI_A\nMULTI_B/);
  }
  const waiting = await call("terminal_textsend", { text: 'read -p "D7_WAIT? " answer; printf "D7_ANSWER=%s\\n" "$answer"', quiet_notify: true, yield_s: 0 });
  const submissions = userSubmissions;
  await until(() => results.has("quiet-answer") && wakes.some((event) => event.kind === "done" && event.result.command_id === waiting.command_id) && host.getSnapshot().state === "idle", "native quiet and done wake turns");
  assert.equal(userSubmissions, submissions);
  assert.ok(wakes.some((event) => event.kind === "quiet" && event.result.command_id === waiting.command_id));
  assert.equal(JSON.parse(text(results.get("quiet-answer"))).command_id, waiting.command_id);
  assert.match(wakes.find((event) => event.kind === "done" && event.result.command_id === waiting.command_id).result.output, /D7_ANSWER=y/);
  assert.ok(session.messages.filter((message) => message.role === "custom" && message.customType === "terminal-event").length >= 2);
  console.log(JSON.stringify({ check: "native-quiet-done-steer", submissions, customMessages: session.messages.filter((m) => m.role === "custom").length, status: "PASS" }));
  }
  const warning = await call("terminal_textsend", { text: "printf '警告\\n%.0s' {1..4000}", output_brake: false, quiet_notify: false, yield_s: 1 });
  assert.equal(warning.status, "done"); assert.equal(warning.truncated, true);
  await until(() => wakes.some((event) => event.kind === "warning" && event.result.command_id === warning.command_id) && host.getSnapshot().state === "idle", "native foreground warning");
  assert.equal(wakes.filter((event) => event.kind === "warning" && event.result.command_id === warning.command_id).length, 1);
  let braked = await call("terminal_textsend", { text: "while :; do printf 'BRAKE_LINE\\n'; done", output_brake: true, quiet_notify: false, yield_s: 1 });
  if (braked.status === "running") braked = await call("terminal_read", { name: "main", command: braked.command_id, yield_s: 1 });
  assert.equal(braked.status, "killed"); assert.equal(braked.truncated, true);
  const closed = await call("terminal_close", { name: "main" }); assert.equal(closed.closed, true);
  console.log(JSON.stringify({ check: "native-warning-brake-close", warning, braked, closed, status: "PASS" }));
} finally {
  binding?.dispose();
  await session?.abort();
  session?.dispose();
  await model.closeAll();
  await terminals.shutdown();
  await rm(root, { recursive: true, force: true });
}
