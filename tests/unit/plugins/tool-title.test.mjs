import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentTools } from "@earendil-works/pi-ai";
import { ModelRuntime, SessionManager, SettingsManager, createAgentSessionFromServices, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { assembleToolTitlePlugin } from "../../../src/plugins/tool-title/assemble-tool-title-plugin.ts";
import { TITLE_PROPERTY } from "../../../src/plugins/tool-title/title-field.ts";
import { assembleKernelPlugin } from "../../../src/plugins/kernel/assemble-kernel-plugin.ts";
import { CELL_TITLE_HINT, createKernelToolDefinition } from "../../../src/plugins/kernel/create-kernel-tool-definition.ts";
import { createSpaceStatusTool } from "../../../src/plugins/sessions/space-status/create-space-status-tool.ts";

const calls = [
  { name: "read", title: "读取笔记", args: { path: "note.txt" } },
  { name: "kernel_code", title: "统计行数", args: { code: "print(1)" } },
  { name: "space_status", title: "查看实例", args: {} },
  { name: "kernel_language", title: "确认内核语言", args: { language: "python" } },
];

test("declared tools require a title that neither Pi validation nor the tools receive; kernel_code keeps its own; off restores the old schemas", async () => {
  const home = await mkdtemp(join(tmpdir(), "prk-title-"));
  let session;
  try {
    await writeFile(join(home, "note.txt"), "title fixture\n");
    let enabled = true;
    const received = new Map();
    const kernel = assembleKernelPlugin(createKernelToolDefinition("fixture", true, async (_id, params) => {
      received.set("kernel_code", params);
      return { content: [{ type: "text", text: "1" }], details: {} };
    }), { enabled: () => false, toolEnabled: () => true, prepareLoadout: () => ({}), afterCompaction() {}, callableTools: () => [],
      prompt: () => assert.fail("disabled kernel renders no prompt"), titleRequired: () => enabled,
      selectLanguage: async (language) => { received.set("kernel_language", { language }); return { status: "unchanged", language }; } });
    const fixture = (pi) => {
      pi.registerTool(createSpaceStatusTool({ spaceStatus: async (target) => { received.set("space_status", { target }); return { targets: [] }; } }));
      pi.on("tool_call", (event) => { if (event.toolName === "read") received.set("read", { ...event.input }); });
    };
    const modelRuntime = await ModelRuntime.create({ authPath: join(home, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
    const provider = fauxProvider({ provider: "unit-title", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
    modelRuntime.registerNativeProvider(provider.provider);
    const services = await createAgentSessionServices({
      cwd: home, agentDir: home, modelRuntime,
      settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }),
      resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, systemPrompt: "Test.",
        extensionFactories: [{ name: "tool-title", factory: assembleToolTitlePlugin(() => enabled) }, { name: "kernel", factory: kernel }, { name: "fixture", factory: fixture }] },
    });
    ({ session } = await createAgentSessionFromServices({ services, sessionManager: SessionManager.inMemory(home),
      model: provider.getModel("controlled"), thinkingLevel: "off", tools: ["read", "kernel_code", "space_status", "kernel_language"] }));
    const declared = [];
    provider.setResponses([
      (context) => {
        declared.push(getCurrentTools(context.messages));
        return fauxAssistantMessage(calls.map(({ name, title, args }) => fauxToolCall(name, { title, ...args }, { id: `call-${name}` })), { stopReason: "toolUse" });
      },
      fauxAssistantMessage("done"),
      (context) => { declared.push(getCurrentTools(context.messages)); return fauxAssistantMessage("plain"); },
    ]);
    await session.prompt("go");

    assert.deepEqual(declared[0].map(({ name }) => name).sort(), ["kernel_code", "kernel_language", "read", "space_status"]);
    for (const tool of declared[0]) {
      assert.equal(Object.keys(tool.parameters.properties)[0], "title", `${tool.name} declares the title first`);
      assert.equal(tool.parameters.required[0], "title", `${tool.name} requires the title`);
      assert.equal(tool.parameters.properties.title.description, TITLE_PROPERTY.description, `${tool.name} shares one title description`);
    }
    assert(!declared[0].find(({ name }) => name === "kernel_code").description.includes(CELL_TITLE_HINT), "the optional-title hint is gone while required");
    assert.deepEqual(received.get("kernel_code"), { title: "统计行数", code: "print(1)" }, "kernel_code receives its own title");
    assert.deepEqual(received.get("kernel_language"), { language: "python" }, "strict prepareArguments sees no title");
    assert.deepEqual(received.get("space_status"), { target: undefined }, "strict schema validated without the title");
    assert.deepEqual(received.get("read"), { path: "note.txt" });
    const messages = session.sessionManager.getBranch().filter((entry) => entry.type === "message").map((entry) => entry.message);
    for (const result of messages.filter((message) => message.role === "toolResult")) assert.equal(result.isError, false, JSON.stringify(result.content));
    const blocks = messages.find((message) => message.role === "assistant" && message.content.some((part) => part.type === "toolCall")).content;
    for (const { name, title, args } of calls) {
      const block = blocks.find((part) => part.name === name);
      if (name === "kernel_code") {
        assert.deepEqual(block.arguments, { title, ...args });
        assert.equal(Object.hasOwn(block, "title"), false);
      } else {
        assert.equal(block.title, title, `${name}: the persisted call keeps its title on the block`);
        assert.deepEqual(block.arguments, args);
      }
    }

    enabled = false;
    await session.prompt("again");
    for (const tool of declared[1].filter(({ name }) => name !== "kernel_code")) assert.equal(Object.hasOwn(tool.parameters.properties ?? {}, "title"), false, `${tool.name} is undeclared while off`);
    const cell = declared[1].find(({ name }) => name === "kernel_code");
    assert.equal(cell.parameters.required.includes("title"), false, "kernel_code title is optional again");
    assert(cell.description.includes(CELL_TITLE_HINT));
  } finally {
    session?.dispose();
    await rm(home, { recursive: true, force: true });
  }
});
