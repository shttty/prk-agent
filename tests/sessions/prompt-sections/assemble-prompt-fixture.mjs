import { executionTargetFromConfig } from "../../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { waitForSessionCondition } from "../derivation/wait-for-session-condition.mjs";
import { readRenderedRequest } from "./read-rendered-request.mjs";
import { startResponsesStub } from "./start-responses-stub.mjs";

export async function assemblePromptFixture({ home, agentDir, config, owned, onCleanup, workerTools = "code", noSkills = true, capabilities = {
  "lazy:tool:session_list": true, "lazy:tool:session_manage": true, "lazy:tool:space_status": true,
  "lazy:group:tools:package:<inline:skill-tools>": true, "lazy:group:tools:package:<inline:memory>": true,
  "lazy:group:tools:package:<inline:plugin-config>": true, "lazy:group:tools:package:<inline:terminals>": true,
  "lazy:group:tools:package:<inline:tool-library>": true,
} }) {
  assert(owned, "Prompt verification must use its own Jupyter server, never an inherited endpoint");
  const cwd = join(home, "project"), plugin = join(home, "capture-extension");
  const captureFile = join(home, "provider-requests.jsonl");
  await Promise.all([mkdir(cwd), mkdir(plugin), mkdir(agentDir, { recursive: true })]);
  process.env.PRK_PROMPT_CAPTURE_FILE = captureFile;
  await writeFile(captureFile, "");
  await writeFile(join(plugin, "package.json"), JSON.stringify({ name: "prk-prompt-capture", pi: { extensions: ["register.mjs"] } }));
  await writeFile(join(plugin, "register.mjs"), `export { default } from ${JSON.stringify(new URL("./register-payload-capture.mjs", import.meta.url).href)};\n`);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: plugin, enabled: true, location: "gateway" }], cacheWarming: "off", compaction: { enabled: false }, retry: { enabled: false } }));
  const document = { session: { noExtensions: false, noContextFiles: true, noSkills, idleTimeoutMs: 60000, localTools: true, workerTools,
    capabilities },
    derivation: { defaultToolMode: workerTools },
    memory: { review: false }, monitor: { enabled: false } };
  await writeFile(join(home, "config.toml"), stringify(document));
  const [{ ModelRuntime }, { createGatewayHost }, { parsePrkConfig }, { parseDerivationConfig }] = await Promise.all([
    import("@earendil-works/pi-coding-agent"), import("../../../src/gateway/host/start-host.ts"), import("../../../src/config/document/parse-prk-config.ts"), import("../../../src/config/derivation/parse-config.ts"),
  ]);
  const stub = await startResponsesStub();
  let host;
  onCleanup(async () => { try { await host?.close(); } finally { await stub.close(); } });
  const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  runtime.registerProvider("prompt-http", { api: "openai-responses", baseUrl: stub.url, apiKey: "owned-local-test-only", models: [{
    id: "controlled", name: "Owned prompt HTTP fixture", reasoning: false, input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 1024,
  }] });
  const model = runtime.getModel("prompt-http", "controlled");
  assert(model);
  assert.equal(new URL(model.baseUrl).hostname, "127.0.0.1", "Every provider call is confined to the owned loopback stub");
  host = await createGatewayHost({ home, cwd, config: parsePrkConfig(document), derivation: parseDerivationConfig(document), model: "prompt-http/controlled", targets: [
    executionTargetFromConfig({ ...config, id: "fixture", label: "Prompt fixture", local: true, tags: [], cwd }),
  ] }, { runtimeDependencies: { model, modelRuntime: runtime, thinkingLevel: "off", autoCompaction: false, cwd, agentDir } });
  const captures = async () => (await readFile(captureFile, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
  const idle = (name) => waitForSessionCondition(() => !host.session(name).getSnapshot().operation, `prompt session ${name} idle`);
  const action = async (name, action, args) => {
    await idle(name);
    const result = await host.nativeAction(name, { sessionId: name, requestId: randomUUID(), action, ...(args === undefined ? {} : { args }) });
    assert.equal(result.status, "completed", JSON.stringify(result));
    return result.data;
  };
  const rendered = (capture) => {
    const request = readRenderedRequest(capture);
    const wire = stub.wireRequests.find((body) => isDeepStrictEqual(JSON.parse(body), request.payload));
    assert(wire, "The public-hook payload must equal a real serialized HTTP request received by the stub");
    return { ...request, wire };
  };
  const captureFor = async (name, { first = false } = {}) => {
    await idle(name);
    const sessionId = host.state(name).sessionId;
    const entries = (await captures()).filter((entry) => entry.sessionId === sessionId);
    const capture = first ? entries[0] : entries.at(-1);
    return rendered(capture);
  };
  const text = (message) => (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
  const run = async (name, tool, args = {}, expectError = false, { parseJson = true } = {}) => {
    await idle(name);
    const offset = (await captures()).length, start = host.state(name).messages.length;
    const admission = await host.session(name).submit({ requestId: randomUUID(), message: tool ? `PROMPT_OPERATION ${JSON.stringify({ tool, args })}` : `PROMPT_CAPTURE ${randomUUID()}` });
    assert.equal(admission.accepted, true, JSON.stringify(admission));
    const outcome = await admission.completion;
    assert.equal(outcome.status, "completed", JSON.stringify(outcome));
    assert.deepEqual(stub.failures, [], "The controlled HTTP fixture must accept only real Responses requests");
    const snapshot = host.state(name);
    const entries = (await captures()).slice(offset).filter((entry) => entry.sessionId === snapshot.sessionId);
    assert(entries.length, "before_provider_request must fire; native faux cannot satisfy this assertion");
    const requests = entries.map(rendered);
    const projected = tool ? snapshot.messages.slice(start).findLast((message) => message.role === "toolResult" && message.toolName === tool) : undefined;
    const result = projected?.outputPreview ? host.toolContent(name, projected.toolCallId).result : projected;
    if (tool) { assert(result, `${tool} must execute through the SDK`); assert.equal(result.isError, expectError, text(result)); }
    return { request: requests[0], requests, result, text: text(result), data: result && !expectError && tool !== "kernel_code" && parseJson ? JSON.parse(text(result)) : undefined };
  };
  return { host, run, action, captureFor, idle, toggle: (name, id, enabled) => action(name, "capabilities", { changes: [{ id, enabled }] }) };
}
