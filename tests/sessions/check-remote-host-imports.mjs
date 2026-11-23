// Real host/socket/native tools; the owned fixture root records execution, not module filenames.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findFixtureExecutable } from "../fixtures/native-tool-artifacts.mjs";
import { withHost } from "../fixtures/remote-host-imports/with-host.mjs";
import { hostSourceFiles, sourceDirectory } from "../../src/remote-extensions/bundle/runtime-source-manifest.ts";

await checkImports(process.execPath);
await checkImports(await findFixtureExecutable("bun", process.env.PI_TEST_BUN_BINARY));

async function checkImports(runtime) {
  assert.equal(process.platform, "linux", "This real host test requires systemd user scopes and cgroup-v2 memory");
  assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Unset JUPYTER_URL/JUPYTER_TOKEN; this test uses only owned fixtures");
  const sdkDir = fileURLToPath(new URL("../", import.meta.resolve("@earendil-works/pi-coding-agent")));
  assert.equal(JSON.parse(await readFile(join(sdkDir, "package.json"), "utf8")).version, "1.6.0", "Reverify the tools/event-bus fixture seam when upgrading Pi");
  const toolsUrl = pathToFileURL(join(sdkDir, "dist/core/tools/index.js")).href;
  const eventBusUrl = pathToFileURL(join(sdkDir, "dist/core/event-bus.js")).href;
  const sdkUrl = import.meta.resolve("@earendil-works/pi-coding-agent");
  const root = await mkdtemp(join(tmpdir(), "prk-host-imports-"));
  try {
    const fixture = join(root, "node_modules/@earendil-works/pi-coding-agent");
    const manifest = (version) => JSON.stringify({ name: "@earendil-works/pi-coding-agent", version, type: "module", exports: { ".": "./dist/index.js" } });
    await mkdir(join(fixture, "dist/core/tools"), { recursive: true });
    await mkdir(join(root, "home"));
    await writeFile(join(root, "package.json"), JSON.stringify({ private: true, type: "module" }));
    for (const { source, destination } of hostSourceFiles) {
      await mkdir(dirname(join(root, destination)), { recursive: true });
      await copyFile(join(sourceDirectory, source), join(root, destination));
    }
    await symlink(dirname(fileURLToPath(import.meta.resolve("jiti/package.json"))), join(root, "node_modules/jiti"));
    for (const name of ["@earendil-works/pi-agent-core", "@earendil-works/pi-ai", "@earendil-works/pi-tui", "typebox"]) {
      await symlink(fileURLToPath(new URL("../", import.meta.resolve(name))), join(root, "node_modules", name));
    }
    // These are our files, not copies or edits of Pi: both paths use the installed native implementations.
    await writeFile(join(fixture, "package.json"), manifest("1.6.0"));
    await writeFile(join(fixture, "dist/core/tools/index.js"), `export * from ${JSON.stringify(toolsUrl)};\n`);
    await writeFile(join(fixture, "dist/core/event-bus.js"), `export { createEventBus } from ${JSON.stringify(eventBusUrl)};\n`);
    await writeFile(join(fixture, "dist/index.js"), `import { appendFileSync } from "node:fs";
appendFileSync(process.env.PRK_TEST_ROOT_SIGNAL, process.pid + "\\n");
export * from ${JSON.stringify(toolsUrl)};
export { createEventBus } from ${JSON.stringify(eventBusUrl)};
export { createExtensionRuntime, DefaultResourceLoader, SettingsManager, ExtensionRunner } from ${JSON.stringify(sdkUrl)};
`);
    const plugin = join(root, "plugin.mjs");
    await writeFile(plugin, `export default function(pi) {
  let received;
  pi.events.on("fixture:signal", (value) => { received = value; });
  pi.events.emit("fixture:signal", "PLUGIN_EVENT_BUS_EXECUTED");
  pi.registerTool({ name: "plugin_probe", label: "Plugin probe", description: "Observe real plugin loading and the Pi event bus",
    parameters: { type: "object", properties: {} },
    async execute() { return { content: [{ type: "text", text: received }] }; } });
}
`);
    await writeFile(join(root, "sample.txt"), "NATIVE_READ_EXECUTED\n");
    const project = join(root, "project.ts");
    const projectSignal = join(root, "project-executed");
    await writeFile(project, `import { appendFileSync } from "node:fs";
import { Type } from "@sinclair/typebox";
appendFileSync(${JSON.stringify(projectSignal)}, process.pid + "\\n");
export default function(pi) {
  pi.events.emit("fixture:signal", "PROJECT_EVENT_BUS_EXECUTED");
  pi.registerTool({ name: "project_probe", label: "Project probe", description: "Observe Pi's target project loader aliases",
    parameters: Type.Object({}),
    async execute() { return { content: [{ type: "text", text: "PROJECT_LOADER_EXECUTED" }] }; } });
}
`);
    const snapshot = { revision: 1, cwd: root, projectTrusted: true, sessionId: "owned-import-test", activeTools: [], branch: [],
      isIdle: true, hasPendingMessages: false, systemPrompt: "" };
    const load = (packages) => ({ generation: randomUUID(), packages, nativeTools: true, snapshot, telemetryIntervalMs: 60_000 });
    const missingSignal = async (path) => {
      await assert.rejects(readFile(path, "utf8"), { code: "ENOENT" }, "No package-root execution signal may exist");
    };
    const execute = (request, registration, name, args) => {
      const tool = registration.tools.find((entry) => entry.name === name);
      assert(tool, `Host must advertise ${name}`);
      return request("execute", { toolId: tool.toolId, toolCallId: `owned-${name}`, args, snapshot });
    };
    const text = (result) => result.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    const noPluginsSignal = join(root, "no-plugins-root-executed");
    await withHost(runtime, root, noPluginsSignal, async (request) => {
      const registration = await request("load", load([]));
      assert.deepEqual(registration.tools.map((tool) => tool.name).sort(), ["bash", "edit", "find", "grep", "ls", "read", "write"]);
      assert(registration.tools.every((tool) => tool.piNativeTool === true));
      assert.match(text(await execute(request, registration, "read", { path: "sample.txt" })), /NATIVE_READ_EXECUTED/u);
      assert.equal(text(await execute(request, registration, "bash", { command: "printf NATIVE_BASH_EXECUTED" })), "NATIVE_BASH_EXECUTED");
      await missingSignal(noPluginsSignal);
    });
    await missingSignal(noPluginsSignal);
    const pluginsSignal = join(root, "plugins-root-executed");
    await withHost(runtime, root, pluginsSignal, async (request) => {
      const registration = await request("load", load([{ name: "owned-plugin", extensions: [plugin] }]));
      assert.equal(await readFile(pluginsSignal, "utf8"), `${registration.pid}\n`, "Plugin mode executes the chosen package root exactly once");
      assert.equal(text(await execute(request, registration, "plugin_probe", {})), "PLUGIN_EVENT_BUS_EXECUTED");
      assert.match(text(await execute(request, registration, "read", { path: "sample.txt" })), /NATIVE_READ_EXECUTED/u);
    });
    await withHost(runtime, root, join(root, "shared-project-root-executed"), async (request) => {
      const registration = await request("load", { ...load([{ name: "owned-plugin", extensions: [plugin] }]), projectExtensions: [project] });
      assert.equal(text(await execute(request, registration, "plugin_probe", {})), "PROJECT_EVENT_BUS_EXECUTED");
      assert.equal(text(await execute(request, registration, "project_probe", {})), "PROJECT_LOADER_EXECUTED");
    });
    const projectOnlySignal = join(root, "project-only-root-executed");
    await withHost(runtime, root, projectOnlySignal, async (request) => {
      const registration = await request("load", { ...load([]), nativeTools: false, projectExtensions: [project] });
      assert.deepEqual(registration.tools.map((tool) => tool.name), ["project_probe"], JSON.stringify(registration.packages));
      assert.equal(text(await execute(request, registration, "project_probe", {})), "PROJECT_LOADER_EXECUTED");
      assert.deepEqual(registration.packages[0].sourceInfo, {
        path: project, source: "local", scope: "project", origin: "top-level", baseDir: undefined,
      });
      assert.equal(await readFile(projectOnlySignal, "utf8"), `${registration.pid}\n`);
    });
    await rm(projectSignal);
    await withHost(runtime, root, join(root, "untrusted-root-executed"), async (request) => {
      const registration = await request("load", { ...load([]), projectExtensions: [project], snapshot: { ...snapshot, projectTrusted: false } });
      assert.match(registration.packages.find((pkg) => pkg.name === `Project extension: ${project}`).error, /Project is not trusted/u);
      assert(!registration.tools.some((tool) => tool.name === "project_probe"));
      await missingSignal(projectSignal);
    });
    await writeFile(join(fixture, "package.json"), manifest("1.6.1"));
    const mismatchSignal = join(root, "mismatch-root-executed");
    await withHost(runtime, root, mismatchSignal, async (request) => {
      await assert.rejects(request("load", load([])), /Remote tools-only host requires Pi 1\.6\.0; found 1\.6\.1\. Reverify the internal tools\/event-bus seam before upgrading\./u);
      await missingSignal(mismatchSignal);
    });
    await missingSignal(mismatchSignal);
    console.log(`PASS ${runtime}: tools-only host executes native read/bash without the Pi package root; plugins execute the root and event bus; unsupported versions fail without fallback`);
  } finally { await rm(root, { recursive: true, force: true }); }
}
