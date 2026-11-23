import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { verifySkillReading } from "../fixtures/skill-library/verify-reading.mjs";
import { verifySkillManagement } from "../fixtures/skill-library/verify-management.mjs";

const home = await mkdtemp(join(tmpdir(), "prk-skills-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools, getCurrentSystemMessage, getSystemMessageText } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { connectWebGateway } = await import("../../src/http/gateway-connection/connect-gateway.ts");
const { startWebServer } = await import("../../src/http/listener/start-listener.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { DEFAULT_LIMITS_OPTIONS } = await import("../../src/config/limits/limits-options.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");
const text = (message) => message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
const fields = {
  scope: "global",
  description: 'Use when inspecting: fixture #workflow "quotes".\nObserved trigger.',
  whenToUse: 'Inspecting fixture: workflow #steps "quoted".\nA second applicability line.',
  evidence: 'Task PRK-LEARN-R3: observed #failure "quoted".\nThe deterministic run completed.',
  procedure: ["BODY_PROOF_61942", "Read references/steps.md before proceeding."],
  pitfalls: [], verification: [],
};
try {
  await withTargetFixture(async ({ config, onCleanup }) => {
    const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "skills-check", models: [{ id: "controlled" }], tokensPerSecond: 10000 });
    runtime.registerNativeProvider(provider.provider);
    const external = join(home, ".agents/skills/external-native/SKILL.md");
    await mkdir(join(home, ".agents/skills/external-native"), { recursive: true });
    await writeFile(external, "---\nname: external-native\ndescription: Use for native nonshared fixture.\n---\nEXTERNAL_NATIVE_BODY_78613\n");
    const host = await createGatewayHost({ cwd: home, home, config: parsePrkConfig({ session: { idleTimeoutMs: 60000 }, memory: { review: false } }), model: "skills-check/controlled", targets: [
      executionTargetFromConfig({ ...config, id: "fixture", label: "Fixture", local: true, tags: [], cwd: home }),
    ] }, { runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: home, agentDir } });
    const socket = join(home, "gateway.sock");
    const server = await startGateway(host, socket);
    onCleanup(() => server.close());
    const client = await connectGateway(socket);
    onCleanup(() => client.disconnect());
    assert.deepEqual(await client.request("skillsList", {}), { skills: [] });
    const adapter = await connectWebGateway({ socket });
    onCleanup(() => adapter.close());
    const web = await startWebServer(adapter, { port: 0, limits: { ...DEFAULT_LIMITS_OPTIONS, identityChars: 44 } });
    onCleanup(() => web.close());
    const post = async (path, body = {}) => {
      const response = await fetch(`${web.url}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: JSON.stringify(body) });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    assert.deepEqual(await post("/api/skills/list"), { skills: [] });
    const create = async (mode, localTools = false) => {
      const worker = (await client.request("createSession", { target: "fixture" })).session.sessionId;
      if (mode !== "code") assert.equal((await client.request("nativeAction", { sessionId: worker, requestId: crypto.randomUUID(), action: "tool-mode", args: { mode } })).status, "completed");
      if (localTools) {
        assert.deepEqual((await client.request("nativeAction", { sessionId: worker, requestId: crypto.randomUUID(), action: "local-tools", args: { enabled: true } })).data, { localTools: true });
        await client.request("reload", { sessionId: worker });
      }
      return worker;
    };
    const run = async (worker, method, args, prompt = "Execute the deterministic skill operation.", expectError = false) => {
      let declarations, userInput, systemPrompt;
      provider.setResponses([
        (context) => { const tools = getCurrentTools(context.messages); declarations = tools.map(({ name }) => name).sort(); userInput = text(context.messages.findLast((message) => message.role === "user")); systemPrompt = getSystemMessageText(getCurrentSystemMessage(context.messages)); return fauxAssistantMessage(fauxToolCall(method, args), { stopReason: "toolUse" }); },
        fauxAssistantMessage("Observed skill operation."),
      ]);
      const admission = await host.session(worker).submit({ requestId: crypto.randomUUID(), message: prompt });
      assert.equal(admission.accepted, true);
      assert.equal((await admission.completion).status, "completed");
      const snapshot = host.state(worker);
      const projected = snapshot.messages.findLast((message) => message.role === "toolResult");
      const result = projected?.outputPreview
        ? (await client.request("toolContent", { sessionId: worker, toolCallId: projected.toolCallId })).result
        : projected;
      assert.equal(result.isError, expectError, text(result));
      return { result, declarations, userInput, systemPrompt };
    };
    const first = await create("code");
    const codeCreate = async (name, values) => run(first, "kernel_code", { code: `import json\nsaved = gateway.skill_manage(**json.loads(${JSON.stringify(JSON.stringify({ action: "create", name, ...values }))}))\nassert saved['skill']['status'] == 'staging'` });
    const service = { ...fields, description: "检查 PRK daily gateway 服务状态；识别用户级 systemd 单元的正确查询方式。", evidence: "PRK-LEARN-R5 fixture verifies the user-requested different-name create policy." };
    await codeCreate("prk-service-status", service);
    await codeCreate("prk-service-status-check", { ...service, description: "查询 PRK 服务状态，使用用户级 systemd 命令。" });
    const duplicate = await run(first, "kernel_code", { code: `import json\ngateway.skill_manage(**json.loads(${JSON.stringify(JSON.stringify({ action: "create", name: "prk-service-status", ...service }))}))` }, undefined, true);
    assert.match(text(duplicate.result), /prk-service-status.*already exists.*patch/);
    assert.deepEqual((await client.request("skillsList", {})).skills.map((item) => item.name), ["prk-service-status", "prk-service-status-check"], "Different names can both be created; an exact-name conflict preserves both entries");
    for (const name of ["prk-service-status", "prk-service-status-check"]) await run(first, "kernel_code", { code: `gateway.skill_manage(action='delete', name=${JSON.stringify(name)})` });
    await codeCreate("fixture-process", fields);
    const maxName = "a".repeat(64);
    await codeCreate(maxName, { ...fields, description: "Maximum length skill URL boundary." });
    const maxPath = `/api/skills/${maxName}`;
    assert((await post("/api/skills/list")).skills.some((item) => item.name === maxName));
    let maxEntry = (await post(`${maxPath}/promote`)).skills.find((item) => item.name === maxName);
    assert.equal(maxEntry.status, "promoted");
    assert.equal(maxEntry.manual, true);
    maxEntry = (await post(`${maxPath}/demote`)).skills.find((item) => item.name === maxName);
    assert.equal(maxEntry.status, "staging");
    maxEntry = (await post(`${maxPath}/archive`)).skills.find((item) => item.name === maxName);
    assert.equal(maxEntry.status, "archived");
    maxEntry = (await post(`${maxPath}/restore`)).skills.find((item) => item.name === maxName);
    assert.equal(maxEntry.status, "staging");
    assert(!(await post(`${maxPath}/delete`)).skills.some((item) => item.name === maxName));
    let entry = (await client.request("skillsList", {})).skills[0];
    assert.equal(entry.status, "staging");
    assert.equal(entry.description, fields.description);
    assert.equal(entry.whenToUse, fields.whenToUse);
    assert.equal(entry.evidence, fields.evidence);
    assert.match(entry.body, /1\. BODY_PROOF_61942/);
    assert.equal(entry.distinctSessions, 0, "Creation is not a successful body read");
    await run(first, "kernel_code", { code: "saved = gateway.skill_manage(action='write_file', name='fixture-process', path='references/steps.md', content='REFERENCE_PROOF_41873')\nassert 'references/steps.md' in saved['skill']['files']" });
    const bodyPath = join(home, "skills", "fixture-process", "SKILL.md");
    const referencePath = join(home, "skills", "fixture-process", "references", "steps.md");
    const current = async () => (await client.request("skillsList", {})).skills.find((item) => item.name === "fixture-process");
    const nativeWorker = await verifySkillReading({ home, create, run, client, referencePath, bodyPath, external, current, initialEntry: entry, text });
    await verifySkillManagement({ home, create, run, client, first, bodyPath, current, fields, post, nativeWorker, text });
    for (const disabled of ["autoTools", "autoSkills"]) {
      const learningHome = join(home, disabled);
      await mkdir(learningHome, { mode: 0o700 });
      await mkdir(join(learningHome, "agent"), { recursive: true });
      await writeFile(join(learningHome, "config.toml"), stringify({ learning: { [disabled]: false }, session: { idleTimeoutMs: 60000 } }));
      const learningHost = await createGatewayHost({ cwd: learningHome, home: learningHome, model: "skills-check/controlled", targets: [
        executionTargetFromConfig({ ...config, id: "fixture", label: "Learning fixture", local: true, cwd: home }),
      ] }, { runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: learningHome, agentDir: join(learningHome, "agent") } });
      const learningSocket = join(learningHome, "gateway.sock");
      const learningServer = await startGateway(learningHost, learningSocket);
      onCleanup(() => learningServer.close());
      const learningClient = await connectGateway(learningSocket);
      onCleanup(() => learningClient.disconnect());
      try {
        const worker = (await learningClient.request("createSession", { target: "fixture" })).session.sessionId;
        const invoke = async (method, args, prompt) => {
          let systemPrompt, declarations;
          provider.setResponses([
            (context) => {
              systemPrompt = getSystemMessageText(getCurrentSystemMessage(context.messages));
              declarations = getCurrentTools(context.messages).map(({ name }) => name);
              return fauxAssistantMessage(fauxToolCall(method, args), { stopReason: "toolUse" });
            },
            fauxAssistantMessage("Observed explicit save operation."),
          ]);
          const admission = await learningHost.session(worker).submit({ requestId: crypto.randomUUID(), message: prompt });
          assert.equal(admission.accepted, true);
          assert.equal((await admission.completion).status, "completed");
          const result = learningHost.state(worker).messages.findLast((message) => message.role === "toolResult");
          assert.equal(result.isError, false, text(result));
          assert.match(systemPrompt, /library_sync\(\)/, "Saved-tool discovery remains operational");
          assert.match(systemPrompt, /gateway\.skill_read\(path=/, "Shared-skill reading remains operational");
          return { result, declarations, systemPrompt };
        };
        const manualTool = await invoke("kernel_code", { code: "@tool(persist=True, reason='Future integer increment checks')\ndef manual_increment(value):\n    return value + 1\nassert manual_increment(41) == 42" }, "Please explicitly save manual_increment as a reusable tool, then call it with 41.");
        assert.deepEqual(manualTool.declarations.toSorted(), ["kernel_code", "kernel_interrupt", "kernel_read"]);
        const savedTool = (await learningClient.request("toolsList", {})).tools.find((item) => item.name === "manual_increment");
        assert.equal(savedTool.status, "staging");
        assert.equal(savedTool.reason, "Future integer increment checks");
        assert.equal((await learningClient.request("nativeAction", { sessionId: worker, requestId: crypto.randomUUID(), action: "tool-mode", args: { mode: "direct" } })).status, "completed");
        const manualSkill = await invoke("skill_manage", { action: "create", name: "manual-process", ...fields, evidence: "PRK-LEARN-R6: the user explicitly requested saving this fixture procedure." }, "Please explicitly save manual-process with the supplied structured fields and evidence.");
        assert(manualSkill.declarations.includes("tool_search") && manualSkill.declarations.includes("tool_call"));
        assert(manualSkill.systemPrompt.includes("skill_manage") && manualSkill.systemPrompt.includes("skill_read"));
        const savedSkill = (await learningClient.request("skillsList", {})).skills.find((item) => item.name === "manual-process");
        assert.equal(savedSkill.status, "staging");
        await learningClient.request("reload", { sessionId: worker });
        const manualRead = await invoke("skill_read", { path: join(learningHome, "skills/manual-process/SKILL.md") }, "Read the explicitly saved shared skill.");
        assert.match(text(manualRead.result), /BODY_PROOF_61942/);
        const reloaded = await invoke("kernel_code", { code: "library_sync()\nassert manual_increment(41) == 42" }, "Call the saved tool after native resource reload.");
        assert(reloaded.declarations.includes("tool_search") && reloaded.declarations.includes("tool_call") && reloaded.systemPrompt.includes("skill_manage") && reloaded.systemPrompt.includes("skill_read"), "Native reload retains on-demand management and reading tools");
        if (process.env.PI_TEST_SKILL_EVIDENCE) {
          await mkdir(process.env.PI_TEST_SKILL_EVIDENCE, { recursive: true });
          await writeFile(join(process.env.PI_TEST_SKILL_EVIDENCE, `learning-${disabled}.json`), JSON.stringify({ disabled, systemPrompt: manualTool.systemPrompt, reloadedSystemPrompt: reloaded.systemPrompt, declarations: manualSkill.declarations, savedTool, savedSkill, readBody: text(manualRead.result) }, null, 2) + "\n");
        }
      } finally {
        learningClient.disconnect();
        await learningServer.close();
      }
    }
    console.log("PASS real SDK/Gateway/HTTP/Jupyter/faux: unread advertised skills stay staging, native discovery and prompts, successful skill_read/native read promotion in code/direct with independent local tools, SDK read/support/slash transport, management and evidence invariant, manual lifecycle routes; independent autoTools/autoSkills encouragement switches preserve explicit saves and native reload");
  });
} finally { await rm(home, { recursive: true, force: true }); }
