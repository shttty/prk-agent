import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
// Real Gateway/Pi/faux + owned Jupyter + target channel + target project extension host. No paid models.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { findFixtureExecutable, prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { checkCwdResourceExecution } from "./cwd-resources/check-execution.mjs";
import { waitForOperation } from "./cwd-resources/wait-for-operation.mjs";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Only owned Jupyter fixtures are allowed");
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
assert.equal(process.env.SHELL, "/bin/bash", "Run this acceptance test with SHELL=/bin/bash");
assert.equal(process.platform, "linux", "The fixture requires Linux mount namespaces");
// allowHidden below exercises task-owned TMPDIR paths, including those under hidden directories.
const root = await mkdtemp(join(tmpdir(), "prk-session-cwd-resources-"));
const home = join(root, "prk");
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
const { agentDir, configPath } = initializePrkHome(home);
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const exists = (path) => access(path).then(() => true, () => false);
const q = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const put = async (path, content) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, content); };

try {
  const bwrap = await findFixtureExecutable("bwrap");
  const python = await findFixtureExecutable("python3", process.env.PI_TEST_PYTHON);
  const artifacts = await prepareNativeToolArtifacts(home);
  const { CONFIG_DIR_NAME, ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  assert.equal(CONFIG_DIR_NAME, ".prk", "Use the installed Pi configuration directory, not a .pi alias");
  await put(join(agentDir, "settings.json"), JSON.stringify({ defaultProjectTrust: "always", compaction: { enabled: true }, retry: { enabled: true } }));
  await put(join(agentDir, "prompts", "global-template.md"), "GLOBAL_TEMPLATE_EXPANDED_61842 value=$1\n");
  for (const [name, marker] of [["cwd-agents-skill", "GLOBAL_SHADOWED_SKILL_61842"], ["global-only-skill", "GLOBAL_ONLY_SKILL_61842"]]) {
    await put(join(process.env.HOME, ".agents/skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${marker}\n---\n${marker}\n`);
  }

  const targetRoot = join(root, "target-storage");
  const samePath = join(root, "same-path");
  const targetCwd = join(samePath, "project", "cwd");
  const childCwd = join(samePath, "project", "alternate");
  const backingCwd = join(targetRoot, "project", "cwd");
  const backingChild = join(targetRoot, "project", "alternate");
  const gatewayCwd = join(root, "gateway-workspace");
  await mkdir(gatewayCwd);
  await put(join(gatewayCwd, "AGENTS.md"), "GATEWAY_BOOTSTRAP_CWD_MUST_NOT_APPEAR\n");
  for (const [relative, marker] of [["", "ANCESTOR"], ["project", "PARENT"], ["project/cwd", "CWD"], ["project/alternate", "CHILD"]]) {
    await put(join(targetRoot, relative, "AGENTS.md"), `TARGET_${marker}_INSTRUCTIONS_61842\n`);
    await put(join(samePath, relative, "AGENTS.md"), `GATEWAY_${marker}_INSTRUCTIONS_MUST_NOT_APPEAR\n`);
  }
  await mkdir(join(targetRoot, "project", ".git"));
  await put(join(targetRoot, "project", CONFIG_DIR_NAME, "prompts", "parent-template.md"), "PARENT_TEMPLATE_EXPANDED_61842 value=$1\n");
  await put(join(targetRoot, "project", CONFIG_DIR_NAME, "prompts", "cwd-template.md"), "PARENT_TEMPLATE_FALLBACK_61842\n");
  await put(join(targetRoot, CONFIG_DIR_NAME, "prompts", "outside-template.md"), "OUTSIDE_GIT_TEMPLATE_MUST_NOT_APPEAR\n");

  const pluginSource = (marker) => `import { writeFileSync } from "node:fs";
import { join } from "node:path";
export default function (pi) {
  const record = (ctx, phase) => {
    const proof = { marker: ${JSON.stringify(marker)}, phase, pid: process.pid, cwd: ctx.cwd, sessionCwd: ctx.sessionManager.getCwd() };
    writeFileSync(join(ctx.cwd, phase === "session_start" ? "resource-start.json" : "resource-execution.json"), JSON.stringify(proof));
    return proof;
  };
  pi.on("session_start", (_event, ctx) => { record(ctx, "session_start"); });
  pi.registerTool({
    name: "cwd_resource_proof", label: "Cwd resource proof", description: "Write an owned target cwd integration proof.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_id, _args, _signal, _update, ctx) {
      const proof = record(ctx, "execute");
      return { content: [{ type: "text", text: JSON.stringify(proof) }], details: proof };
    },
  });
}
`;
  for (const [backing, logical, name, marker, compaction] of [
    [backingCwd, targetCwd, "cwd", "TARGET_CWD", false],
    [backingChild, childCwd, "child", "TARGET_CHILD", true],
  ]) {
    const settings = { compaction: { enabled: compaction }, retry: { enabled: false } };
    await put(join(backing, CONFIG_DIR_NAME, "settings.json"), JSON.stringify(settings));
    await put(join(logical, CONFIG_DIR_NAME, "settings.json"), JSON.stringify({ compaction: { enabled: !compaction }, retry: { enabled: true } }));
    await put(join(backing, CONFIG_DIR_NAME, "prompts", `${name}-template.md`), `---\ndescription: ${marker}_TEMPLATE_DESCRIPTION\n---\n${marker}_TEMPLATE_EXPANDED value=$1\n`);
    await put(join(logical, CONFIG_DIR_NAME, "prompts", `${name}-template.md`), "GATEWAY_TEMPLATE_MUST_NOT_EXPAND\n");
    for (const [base, skillName, description] of [
      [CONFIG_DIR_NAME, `${name}-pi-skill`, `${marker}_PI_SKILL_DESCRIPTION`],
      [".agents", `${name}-agents-skill`, `${marker}_AGENTS_SKILL_DESCRIPTION`],
    ]) {
      await put(join(backing, base, "skills", skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: ${description}\n---\n${marker}_SKILL_BODY_MUST_NOT_APPEAR\n`);
      await put(join(logical, base, "skills", skillName, "SKILL.md"), `---\nname: ${skillName}\ndescription: GATEWAY_SKILL_MUST_NOT_APPEAR\n---\nGATEWAY_SKILL_BODY_MUST_NOT_APPEAR\n`);
    }
    // Direct project entry; no package.json, npm pack, installation, or uploaded plugin bundle.
    await put(join(backing, CONFIG_DIR_NAME, "extensions", "cwd-proof.js"), pluginSource("TARGET_EXTENSION_PROOF_61842"));
    await put(join(logical, CONFIG_DIR_NAME, "extensions", "cwd-proof.js"), pluginSource("GATEWAY_EXTENSION_MUST_NOT_EXECUTE"));
  }

  const wrapper = join(root, "target-python");
  const runtimeDirectory = process.env.XDG_RUNTIME_DIR ?? "/tmp";
  await put(wrapper, `#!/bin/bash\nexec ${q(bwrap)} --ro-bind / / --bind ${q(runtimeDirectory)} ${q(runtimeDirectory)} --bind ${q(root)} ${q(root)} --bind ${q(targetRoot)} ${q(samePath)} --dev /dev --proc /proc --setenv SHELL /bin/bash ${q(python)} "$@"\n`);
  await chmod(wrapper, 0o700);

  await withTargetFixture(async ({ config, owned, onCleanup, tempRoot }) => {
    assert.equal(owned, true);
    for (const [name, marker] of [["cwd-agents-skill", "TARGET_HOME_SHADOWED_SKILL"], ["target-only-skill", "TARGET_HOME_ONLY_SKILL"]]) {
      await put(join(tempRoot, ".agents/skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: ${marker}\n---\n${marker}\n`);
    }
    for (const name of ["cwd-template", "target-only-template"]) await put(join(tempRoot, CONFIG_DIR_NAME, "agent/prompts", `${name}.md`), "TARGET_HOME_TEMPLATE_MUST_NOT_EXPAND\n");
    const document = {
      monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 }, memory: { review: false }, remoteHost: { runtime: "bun" },
      session: { noContextFiles: false, noPromptTemplates: false, noExtensions: false, noSkills: false, noThemes: true,
        bootstrapNoSkills: false, localTools: false, workerTools: "direct", idleTimeoutMs: 600000 },
      limits: { contextFileBytes: 65536, contextTotalBytes: 262144 },
    };
    await writeFile(configPath, stringify(document));
    const configuration = parsePrkConfig(document);
    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "session-cwd-resources", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const requests = [];
    provider.setResponses(Array.from({ length: 30 }, () => (context) => {
      const last = context.messages.at(-1);
      requests.push({ system: getSystemMessageText(getCurrentSystemMessage(context.messages)),
        firstSystem: context.messages[0]?.role === "system" ? getSystemMessageText(context.messages[0]) : undefined,
        input: text(last), role: last?.role, tools: getCurrentTools(context.messages).map((tool) => tool.name) });
      if (last?.role === "user") {
        const command = /^TOOL (\{.*\})$/su.exec(text(last));
        if (command) {
          const { tool, args } = JSON.parse(command[1]);
          return fauxAssistantMessage(fauxToolCall(tool, args), { stopReason: "toolUse" });
        }
        if (text(last).includes("TARGET_CWD_TEMPLATE_EXPANDED") || text(last).includes("CHILD_RESOURCE_FIRST_TURN_61842")) {
          return fauxAssistantMessage(fauxToolCall("cwd_resource_proof", {}), { stopReason: "toolUse" });
        }
      }
      return fauxAssistantMessage("Observed owned cwd resources.");
    }));
    const generations = [];
    const host = await createGatewayHost({ cwd: gatewayCwd, home, config: configuration, historyDir: join(home, "history"),
      model: "session-cwd-resources/controlled", thinkingLevel: "off",
      targets: [executionTargetFromConfig({ ...config, id: "fixture", label: "Owned cwd resources", local: false, tags: [], sshCommand: "/bin/sh", cwd: targetCwd })],
    }, {
      runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: gatewayCwd, agentDir },
      onRemoteExtensionGeneration(generation, context) { generations.push({ ...context, host: generation }); },
    });
    let endpoint, client;
    onCleanup(async () => { await client?.disconnect(); if (endpoint) await endpoint.close(); else await host.close(); });
    endpoint = await startGateway(host, join(root, "gateway.sock"));
    client = await connectGateway(join(root, "gateway.sock"));
    const native = async (worker, action, args) => {
      const result = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
      assert.equal(result.status, "completed", JSON.stringify(result));
      return result.data;
    };
    const send = async (worker, message, mode = "plain") => {
      const admission = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message, mode });
      assert.equal(admission.accepted, true, JSON.stringify(admission));
      const completion = await waitForOperation(admission.completion, message);
      assert.equal(completion.status, "completed", JSON.stringify(completion));
    };
    const invoke = async (worker, tool, args) => {
      const start = host.session(worker).getSnapshot().messages.length;
      await send(worker, `TOOL ${JSON.stringify({ tool, args })}`);
      const result = host.session(worker).getSnapshot().messages.slice(start).findLast((entry) => entry.role === "toolResult" && entry.toolName === tool);
      assert(result, `${tool} must execute through the real SDK`);
      assert.equal(result.isError, false, text(result));
      return result;
    };
    const waitForIdle = async (worker) => {
      const workerHost = host.session(worker);
      const done = Promise.withResolvers();
      const check = () => { const snapshot = workerHost.getSnapshot(); if (snapshot.state === "idle" && !snapshot.operation) done.resolve(); };
      const subscription = workerHost.subscribe(check);
      try { check(); await waitForOperation(done.promise, `settled child ${worker}`); }
      finally { subscription.unsubscribe(); }
    };
    const exportedCwd = async (worker) => {
      const exported = await native(worker, "export", { format: "jsonl" });
      const header = JSON.parse(exported.content.split("\n")[0]);
      assert.equal(header.type, "session");
      return header.cwd;
    };
    const assertContextOrder = (prompt, markers) => {
      let previous = -1;
      for (const marker of markers) {
        const index = prompt.indexOf(marker);
        assert(index > previous, `${marker} must occur in root-to-cwd context order`);
        assert.equal(prompt.indexOf(marker, index + marker.length), -1, `${marker} is injected exactly once`);
        previous = index;
      }
      assert(!prompt.includes("GATEWAY_"), "No same-path Gateway project resource or bootstrap cwd may enter the target prompt");
    };
    await checkCwdResourceExecution({ host, client, requests, generations, tempRoot, artifacts, send, invoke, exportedCwd, assertContextOrder, exists, put, configuration, samePath, targetRoot, targetCwd, childCwd, backingCwd, backingChild, CONFIG_DIR_NAME, waitForIdle, text });
  }, { pythonExecutable: wrapper, tempParent: root, allowHidden: true, rootDir: () => "/" });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
