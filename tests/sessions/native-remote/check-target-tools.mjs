import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export async function checkTargetTools(fixture) {
  const { client, native, changeNative, generations, pkg, host, nativeNames, kernel, nativeKernelAssertions,
    assertNativePrompt, text, events, backingCwd, proof, invoke, files, q, targetCwd, gatewayNetworkNamespace,
    artifacts, targetPath, gatewayCwd, exists, byteCounts, fileBytes } = fixture;
      const remote = (await client.request("createSession", { target: "remote" })).session.sessionId;
      const initiallyLoaded = generations.findLast((entry) => entry.sessionId === remote && entry.package === pkg.source)?.host;
      assert(initiallyLoaded?.registration, "Target plugins require their shared host during registration, even while native tools are disabled");
      const disabledCatalog = await native(remote, "capabilities");
      for (const name of nativeNames) {
        const entry = disabledCatalog.entries.find((item) => item.id === `tool:${name}`);
        assert.equal(entry?.loaded, true, `Disabled native ${name} is already registered`);
        assert.equal(entry.enabled, false);
      }
      await changeNative(remote, true);
      const remoteGeneration = generations.findLast((entry) => entry.sessionId === remote && entry.package === pkg.source)?.host;
      assert(remoteGeneration, "The fixture hooks must run in a real remote extension host");
      assert.equal(remoteGeneration, initiallyLoaded, "Enabling native tools reuses the plugin registration host");
      assert.notEqual(remoteGeneration.registration.pid, process.pid);
      const nativeGeneration = generations.findLast((entry) => entry.sessionId === remote && entry.package === "Pi native tools")?.host;
      assert(nativeGeneration, "All seven native definitions must load in their real target host");
      assert.notEqual(nativeGeneration.registration.pid, process.pid);
      assert.equal(nativeGeneration, remoteGeneration, "Native tools and target plugins share one session host generation");
      assert.deepEqual((await host.pluginsList()).packages.filter((pkg) => pkg.error), []);
      const nativeCatalog = await native(remote, "capabilities");
      for (const name of nativeNames) {
        const entry = nativeCatalog.entries.find((entry) => entry.id === `tool:${name}`);
        assert.equal(entry?.group, "group:tools:local", `${name} belongs to the existing native-tools switch`);
        assert.equal(entry.loaded, true);
        assert.equal(entry.enabled, true);
      }
      const nestedRead = await kernel(remote, `${nativeKernelAssertions}\nimport shutil\nassert all(shutil.which(name) is None for name in ["rg", "fd", "fdfind"])\nassert "NATIVE_REAL_CONTENT" in gateway.read(path="content.txt", limit=1)\nassert "NATIVE_REAL_CONTENT" in gateway.native_fixture_read(path="content.txt")\nprint("NATIVE_CALLBACKS_RETURN_REAL_CONTENT")`);
      assertNativePrompt(nestedRead);
      assert.match(text(nestedRead.result), /NATIVE_CALLBACKS_RETURN_REAL_CONTENT/);
      const nestedEvents = (await events(backingCwd)).filter((entry) => entry.phase === "tool_result" && entry.toolName === "read");
      assert(nestedEvents.length >= 2);
      for (const event of nestedEvents) {
        assert.match(text(event), /NATIVE_REAL_CONTENT/, "Both gateway.read and plugin ctx.executeTool receive the real Pi page");
        assert.match(event.toolCallId, /\/\d+$/);
        assert.equal(event.pid, remoteGeneration.registration.pid);
      }
      proof("native-kernel-exclusivity-and-callbacks", { sessionId: remote, pid: remoteGeneration.registration.pid, filesModuleLoaded: true, filesPermission: "disabled", nestedReadIds: nestedEvents.map((event) => event.toolCallId) });

      const written = await invoke(remote, "write", { path: "written.txt", content: "NATIVE_DIRECT_WRITE\n" });
      assertNativePrompt(written);
      assert.equal(await readFile(join(backingCwd, "written.txt"), "utf8"), "NATIVE_DIRECT_WRITE\n");
      const directRead = await invoke(remote, "read", { path: "written.txt", offset: 1, limit: 1 });
      assertNativePrompt(directRead);
      assert.match(text(directRead.result), /NATIVE_DIRECT_WRITE/);
      // Legacy args require the public Pi prepareArguments hook before Gateway schema validation.
      // The original contains both smart quotes and trailing whitespace: a PRK exact outlet cannot match it.
      assert(!files["fuzzy.txt"].includes('const greeting = "remote";\n'));
      const fuzzy = await invoke(remote, "edit", { path: "fuzzy.txt", oldText: 'const greeting = "remote";\n', newText: "NATIVE_FUZZY_CHANGED\n" });
      assertNativePrompt(fuzzy);
      assert.equal(await readFile(join(backingCwd, "fuzzy.txt"), "utf8"), "NATIVE_FUZZY_CHANGED\nstable\n");
      assert.match(text(fuzzy.result), /NATIVE_PLUGIN_RESULT_DIAGNOSTIC/);
      const image = await invoke(remote, "read", { path: "pixel.png" });
      assertNativePrompt(image);
      const imageBlock = image.result.content.find((part) => part.type === "image");
      assert(imageBlock, "Pi native read must return an image block for the real PNG");
      assert.equal(imageBlock.mimeType, "image/png");
      assert.equal(Buffer.from(imageBlock.data, "base64").subarray(0, 8).toString("hex"), "89504e470d0a1a0a");

      const bashCode = 'import hashlib,json,os,shutil\nfrom pathlib import Path\nPath("bash.txt").write_text("NATIVE_BASH_TARGET\\n")\nprint(json.dumps({"cwd":os.getcwd(),"pid":os.getpid(),"offline":os.environ.get("PI_OFFLINE"),"networkNamespace":os.readlink("/proc/self/ns/net"),"tools":{name:{"path":shutil.which(name),"sha256":hashlib.sha256(Path(shutil.which(name)).read_bytes()).hexdigest()} for name in ["rg","fd"]}}))';
      const bash = await invoke(remote, "bash", { command: `python3 -c ${q(bashCode)}` });
      assertNativePrompt(bash);
      const environment = JSON.parse(text(bash.result).trim());
      assert.equal(environment.cwd, targetCwd);
      assert.notEqual(environment.pid, process.pid);
      assert.equal(environment.offline, "1");
      assert.notEqual(environment.networkNamespace, gatewayNetworkNamespace, "Native host children must have no download network");
      assert.equal(await readFile(join(backingCwd, "bash.txt"), "utf8"), "NATIVE_BASH_TARGET\n");
      for (const name of ["rg", "fd"]) {
        assert.notEqual(environment.tools[name].path, artifacts[name].source, "Pi must resolve the imported target artifact, not the system binary");
        assert.equal(environment.tools[name].sha256, artifacts[name].sha256);
      }
      const grep = await invoke(remote, "grep", { pattern: "NATIVE_SEARCH_NEEDLE", path: ".", glob: "needle-only.txt", limit: 1 });
      assertNativePrompt(grep);
      assert.match(text(grep.result), /needle-only\.txt:1: NATIVE_SEARCH_NEEDLE/);
      const find = await invoke(remote, "find", { pattern: "needle-only.txt", path: "." });
      assertNativePrompt(find);
      assert.equal(text(find.result).trim(), "needle-only.txt");
      const ls = await invoke(remote, "ls", { path: "." });
      assertNativePrompt(ls);
      assert.match(text(ls.result), /needle-only\.txt/);
      const toolEvents = await events(backingCwd);
      for (const name of nativeNames) for (const phase of ["tool_call", "tool_result"]) {
        const event = toolEvents.find((entry) => entry.phase === phase && entry.toolName === name);
        assert(event, `${name} must emit ${phase} on the target`);
        assert.equal(event.pid, remoteGeneration.registration.pid);
        assert.equal(event.cwd, targetCwd);
      }
      const startEvent = toolEvents.findLast((entry) => entry.phase === "session_start");
      assert.equal(startEvent.offline, "1", "The shared native/plugin host must override the fixture PI_OFFLINE baseline for every package");
      assert.equal(startEvent.basePath, targetPath);
      assert.notEqual(startEvent.networkNamespace, gatewayNetworkNamespace);
      for (const name of ["content.txt", "fuzzy.txt", "written.txt", "bash.txt"]) {
        assert.equal(await readFile(join(gatewayCwd, name), "utf8"), "GATEWAY_SENTINEL\n");
        assert.equal(await exists(`${targetCwd}/${name}`), false);
      }
      proof("all-seven-native-tools-target-only", { names: nativeNames, gatewayPid: process.pid, nativeHostPid: nativeGeneration.registration.pid, pluginHostPid: remoteGeneration.registration.pid, gatewaySentinelsUnchanged: true, imageMime: imageBlock.mimeType, fuzzyAndLegacyArguments: true });
      proof("offline-artifact-search", { artifacts, environment, baselinePath: targetPath, downloadsPossible: false, isolation: "real channel/Node children in bwrap --unshare-net; owned Jupyter/ZMQ remains reachable" });

      const blocked = await invoke(remote, "edit", { path: "blocked.txt", edits: [{ oldText: "NATIVE_BLOCKED_ORIGINAL", newText: "MUST_NOT_WRITE" }] }, true);
      assert.match(text(blocked.result), /NATIVE_PLUGIN_DENIED/);
      assert.equal(await readFile(join(backingCwd, "blocked.txt"), "utf8"), files["blocked.txt"]);
      const mutated = await invoke(remote, "edit", { path: "mutate.txt", edits: [{ oldText: "NATIVE_MUTATE_ORIGINAL", newText: "MODEL_REQUESTED_TEXT" }] });
      assertNativePrompt(mutated);
      assert.equal(await readFile(join(backingCwd, "mutate.txt"), "utf8"), "NATIVE_PLUGIN_MUTATED\n");
      const hookEvents = await events(backingCwd);
      const mutation = hookEvents.findLast((entry) => entry.phase === "tool_call" && entry.toolName === "edit" && entry.input.path === "mutate.txt");
      assert.equal(mutation.input.edits[0].newText, "MODEL_REQUESTED_TEXT");
      assert.equal(mutation.executedInput.edits[0].newText, "NATIVE_PLUGIN_MUTATED");
      const editResult = hookEvents.findLast((entry) => entry.phase === "tool_result" && entry.toolName === "edit" && entry.input.path === "fuzzy.txt");
      assert.deepEqual(Object.keys(editResult.details).sort(), ["diff", "firstChangedLine", "patch"]);
      assert.equal(editResult.details.firstChangedLine, 1);
      assert.match(editResult.details.diff, /NATIVE_FUZZY_CHANGED/);
      assert.match(editResult.details.patch, /NATIVE_FUZZY_CHANGED/);
      proof("native-plugin-contract", { intercepted: true, argumentsMutated: true, resultDiagnosticVisible: true, details: editResult.details });

      const measure = async (name, operation) => {
        const before = { ...byteCounts.remote };
        const result = await operation();
        const sent = byteCounts.remote.sent - before.sent;
        const received = byteCounts.remote.received - before.received;
        const totalBytes = sent + received;
        assert(sent > 0 && received > 0, "Measure actual TargetTransport bytes in both directions");
        assert.equal(byteCounts.remote.opens, before.opens, "Measured interval must not contain bootstrap/replacement transport");
        assert(totalBytes < fileBytes / 20, JSON.stringify({ name, fileBytes, sent, received, totalBytes }));
        proof(name, { fileBytes, sent, received, totalBytes, fractionOfFile: totalBytes / fileBytes, measurement: "actual UTF-8 TargetTransport pipe bytes, both directions" });
        return result;
      };
      const largeEdit = await measure("large-native-edit-channel-bytes", () => invoke(remote, "edit", { path: "large.txt", edits: [{ oldText: "LARGE_NATIVE_OLD", newText: "LARGE_NATIVE_CHANGED" }] }));
      assertNativePrompt(largeEdit);
      const largeRead = await measure("large-native-read-page-channel-bytes", () => invoke(remote, "read", { path: "large.txt", offset: 1, limit: 3 }));
      assertNativePrompt(largeRead);
      assert.match(text(largeRead.result), /LARGE_NATIVE_CHANGED/);
      assert((await stat(join(backingCwd, "large.txt"))).size >= 5 * 1024 * 1024);
      await kernel(remote, 'from pathlib import Path\nwith Path("large.txt").open("rb") as actual_large:\n    assert actual_large.readline() == b"LARGE_NATIVE_CHANGED\\n"\nnative_switch_sentinel = 7391');
      return remote;
}
