import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime, SessionManager, SettingsManager, createAgentSessionFromServices, createAgentSessionServices } from "@earendil-works/pi-coding-agent";
import { createNativeInteractionService } from "../../src/sessions/native-interaction/assemble-native-interaction.ts";
import { createSessionHost } from "../../src/sessions/host/assemble-host.ts";

const directory = await mkdtemp(join(tmpdir(), "native-sdk-resources-"));
let session;
let host;
try {
  const skillDirectory = join(directory, "skills", "controlled");
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(join(skillDirectory, "SKILL.md"), "---\nname: controlled\ndescription: Controlled resource availability proof.\n---\nThis must not run while skill commands are disabled.\n");
  const calls = [];
  const modelRuntime = await ModelRuntime.create({ authPath: join(directory, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const services = await createAgentSessionServices({
    cwd: directory,
    agentDir: directory,
    modelRuntime,
    settingsManager: SettingsManager.inMemory({ enableSkillCommands: false, compaction: { enabled: false } }),
    resourceLoaderOptions: {
      noExtensions: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      additionalSkillPaths: [join(directory, "skills")],
      extensionFactories: ["first", "second"].map((name) => ({ name, factory: (pi) => {
        pi.registerCommand("collision", { description: name, handler: async () => { calls.push(name); } });
      } })),
    },
  });
  const sessionFile = join(directory, "session.jsonl");
  await writeFile(sessionFile, "");
  ({ session } = await createAgentSessionFromServices({ services, sessionManager: SessionManager.open(sessionFile, directory, directory), tools: [], customTools: [] }));
  host = createSessionHost({ session });
  const target = { sessionId: session.sessionId, streamId: host.getSnapshot().streamId, state: "idle", readOnly: false, session, host, manager: session.sessionManager };
  const service = createNativeInteractionService();
  const catalog = service.catalog(target);
  const resolved = session.extensionRunner.getRegisteredCommands();
  assert.equal(resolved.length, 2);
  assert.deepEqual(catalog.commands.filter((command) => command.description === "first" || command.description === "second").map((command) => command.name), resolved.map((command) => command.invocationName));
  assert.equal(catalog.commands.some((command) => command.name === "collision"), false);
  for (const command of resolved) {
    const submitted = await service.send(target, { sessionId: target.sessionId, requestId: command.invocationName, message: `/${command.invocationName}`, mode: "auto" });
    assert.equal(submitted.accepted, true);
    assert.equal((await submitted.completion).status, "completed");
  }
  assert.deepEqual(calls, ["first", "second"]);
  const disabledSkill = catalog.commands.find((command) => command.name === "skill:controlled");
  assert.equal(disabledSkill?.availability.enabled, false);
  const disabledSend = await service.send(target, { sessionId: target.sessionId, requestId: "disabled-skill", message: "/skill:controlled", mode: "auto" });
  assert.equal(disabledSend.accepted, false);
  assert.equal(disabledSend.executed, false);
  const exportDirectory = join(directory, "exports");
  await mkdir(exportDirectory);
  const originalTmpdir = process.env.TMPDIR;
  process.env.TMPDIR = exportDirectory;
  try {
    const expectedHtmlPath = await session.exportToHtml(join(directory, "expected.html"));
    const expectedHtml = await readFile(expectedHtmlPath, "utf8");
    const branchBeforeHtmlExport = session.sessionManager.getBranch();
    const exportTempNames = async () => (await readdir(exportDirectory)).sort();
    const exportTempNamesBefore = await exportTempNames();
    const exportedHtml = await service.action(target, { sessionId: target.sessionId, requestId: "export-html", action: "export", args: { format: "html" } });
    assert.equal(exportedHtml.status, "completed");
    assert.equal(exportedHtml.data.content, expectedHtml);
    assert.deepEqual(session.sessionManager.getBranch(), branchBeforeHtmlExport);
    assert.deepEqual(await exportTempNames(), exportTempNamesBefore);
  } finally {
    if (originalTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTmpdir;
  }
  const branchBeforeExport = session.sessionManager.getBranch();
  const exported = await service.action(target, { sessionId: target.sessionId, requestId: "export", action: "export", args: { format: "jsonl" } });
  assert.equal(exported.status, "completed");
  const entries = exported.data.content.trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(entries.slice(1), branchBeforeExport);
  console.log("Native SDK resolved commands, disabled resources and native HTML/JSONL exports passed.");
} finally {
  if (host) await host.close();
  else session?.dispose();
  await rm(directory, { recursive: true, force: true });
}
