// Operator prompt files are appended after PRK's explicit system prompt and re-read per session.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";

const home = await mkdtemp(join(tmpdir(), "prk-append-prompt-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } = await import("@earendil-works/pi-coding-agent");
const { fauxProvider } = await import("@earendil-works/pi-ai");
const { readAppendSystemPrompt } = await import("../../src/config/session/read-append-system-prompt.ts");
try {
  assert.deepEqual(readAppendSystemPrompt("", agentDir), []);
  assert.throws(() => readAppendSystemPrompt("prompts/missing.md", agentDir), /Cannot read configured session prompt file .*prompts\/missing\.md/);
  await mkdir(join(home, "prompts"));
  await writeFile(join(home, "prompts", "main.md"), "\nOPERATOR_APPEND_MARKER\n");
  const append = readAppendSystemPrompt("prompts/main.md", agentDir);
  assert.deepEqual(append, ["OPERATOR_APPEND_MARKER"]);

  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false });
  const provider = fauxProvider({ tokensPerSecond: 10000 });
  modelRuntime.registerNativeProvider(provider.provider);
  const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });
  const resourceLoader = new DefaultResourceLoader({ cwd: home, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true, systemPrompt: "PRK_BUILTIN_MARKER", appendSystemPrompt: append });
  await resourceLoader.reload();
  const { session } = await createAgentSession({ cwd: home, agentDir, modelRuntime, model: provider.getModel(), thinkingLevel: "off", resourceLoader, settingsManager, sessionManager: SessionManager.inMemory(home), tools: [] });
  try {
    const prompt = session.systemPrompt;
    assert.ok(prompt.includes("PRK_BUILTIN_MARKER") && prompt.includes("OPERATOR_APPEND_MARKER"), prompt);
    assert.ok(prompt.indexOf("PRK_BUILTIN_MARKER") < prompt.indexOf("OPERATOR_APPEND_MARKER"), "operator prompt must follow the built-in prompt");
  } finally {
    session.dispose();
  }
  console.log("append prompt checks passed");
} finally {
  await rm(home, { recursive: true, force: true });
}
