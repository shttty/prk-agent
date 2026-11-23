import assert from "node:assert/strict";
import { join } from "node:path";

export async function checkDefinitions(load, home, agentDir) {
  const [{ DefaultResourceLoader, SettingsManager }, { ToolLibrary }, { assembleToolLibraryPlugin },
    { assembleKernelPlugin }, { createKernelToolDefinition }, { assembleToolSearchPlugin }] = await Promise.all([
    import("@earendil-works/pi-coding-agent"), load("src/codemode/tool-library/assemble-tool-library.ts"),
    load("src/plugins/tool-library/assemble-tool-library-plugin.ts"), load("src/plugins/kernel/assemble-kernel-plugin.ts"),
    load("src/plugins/kernel/create-kernel-tool-definition.ts"), load("src/plugins/tool-search/assemble-tool-search-plugin.ts"),
  ]);
  const unavailable = () => { throw new Error("Definition-only probe must not execute worker callbacks"); };
  const library = new ToolLibrary(home);
  assert(library.list().some(({ name }) => name === "closing_increment"), "Probe real persisted source, not fabricated saved-tool metadata");
  let registration;
  const loader = new DefaultResourceLoader({ cwd: join(home, "project"), agentDir, settingsManager: SettingsManager.inMemory({}),
    noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true,
    extensionFactories: [
      { name: "kernel", factory: assembleKernelPlugin(createKernelToolDefinition("target", true)) },
      { name: "tool-library", factory: assembleToolLibraryPlugin(library, { target: "fixture", python: unavailable,
        sessionId: unavailable, registered: (value) => { registration = value; } }) },
      { name: "tool-search", factory: assembleToolSearchPlugin() },
    ],
  });
  try {
    await loader.reload();
    const { extensions, errors } = loader.getExtensions();
    assert.deepEqual(errors, []);
    const tool = (plugin, name) => {
      const extension = extensions.find(({ path }) => path === `<inline:${plugin}>`);
      assert(extension, `${plugin} must load through the real SDK inline factory`);
      const registered = extension.tools.get(name);
      assert(registered, `${name} must be registered by ${plugin}`);
      assert.equal(registered.sourceInfo.path, `<inline:${plugin}>`);
      assert.equal(registered.sourceInfo.source, "inline");
      return registered.definition;
    };
    const kernel = tool("kernel", "kernel_code");
    assert.equal(kernel.exposure, "model-only");
    const callbacks = ["prk_library_save", "prk_library_access", "prk_library_used", "prk_library_available"];
    const libraryExtension = extensions.find(({ path }) => path === "<inline:tool-library>");
    assert.deepEqual(new Set(libraryExtension.tools.keys()), new Set([...callbacks, "prk_saved_closing_increment"]));
    for (const name of [...callbacks, "prk_saved_closing_increment"]) assert.equal(tool("tool-library", name).exposure, "codemode");
    assert(!libraryExtension.tools.has("tool_save") && !libraryExtension.tools.has("tool_remove"), "Keep the actual B1 API, not nonexistent management tools");
    const search = tool("tool-search", "tool_search"), call = tool("tool-search", "tool_call");
    assert.equal(search.exposure, "model-only");
    assert.equal(call.exposure, "model-only");
    assert.equal(search.reachesTools({}), "all");
    assert.deepEqual(call.reachesTools({ name: "session_list" }), ["session_list"]);
    await assert.rejects(async () => search.execute("definition-search", { query: "session_list" }), /worker/u);
    await assert.rejects(async () => call.execute("definition-call", { name: "session_list", args: {} }), /worker/u);
    return { callbacks, savedTools: ["prk_saved_closing_increment"], sources: ["kernel", "tool-library", "tool-search"] };
  } finally { registration?.dispose(); }
}
