import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkLazyHost(fixture) {
  const { client, changeNative, generations, nativeNames, native, kernel, assertDeclared, invoke,
    assertNativePrompt, text, backingCwd, targetCwd, exists, byteCounts, proof, home } = fixture;
  const bare = (await client.request("createSession", { target: "bare" })).session.sessionId;
  const assertCold = async () => {
    assert.equal(generations.some((entry) => entry.sessionId === bare), false, "Native-only registration and switches must not load a target host");
    const row = (await client.request("workbench")).sessions.find((entry) => entry.sessionId === bare);
    assert(row, "The native-only worker remains present in the real workbench snapshot");
    if (row.monitor !== undefined) {
      assert.equal(row.monitor.remoteHost, null, "When monitoring is exposed, it reports no native host before a real call");
    }
  };
  await assertCold();
  const catalog = await native(bare, "capabilities");
  for (const name of nativeNames) {
    const entry = catalog.entries.find((entry) => entry.id === `tool:${name}`);
    assert.equal(entry?.loaded, true, `Disabled native ${name} is already registered`);
    assert.equal(entry.enabled, false);
  }
  const disabled = await invoke(bare, "bash", { command: "printf MUST_NOT_EXECUTE" }, true);
  assertDeclared(disabled, false);
  assert.match(text(disabled.result), /bash.*关闭/u);
  await assertCold();
  await changeNative(bare, true);
  assertNativePrompt(await kernel(bare, 'lazy_native_sentinel = 7397\nprint("LAZY_NATIVE_NO_EXECUTE")'));
  await assertCold();
  await changeNative(bare, false);
  assertDeclared(await kernel(bare, 'assert lazy_native_sentinel == 7397\nprint("LAZY_NATIVE_OFF")'), false);
  await assertCold();
  await changeNative(bare, true);
  await assertCold();
  const bareWrite = await invoke(bare, "write", { path: "bare-native.txt", content: "NATIVE_WITHOUT_PLUGINS\n" });
  assertNativePrompt(bareWrite);
  const generation = generations.findLast((entry) => entry.sessionId === bare && entry.package === "Pi native tools")?.host;
  assert(generation?.registration, "The first real native execute loads the real target host");
  const pid = generation.registration.pid;
  assert.notEqual(pid, process.pid);
  assert.equal(await exists(`/proc/${pid}`), true, "Observe the actual native host process");
  assert.deepEqual(generation.registration.tools.map((entry) => entry.name).sort(), nativeNames);
  const bareRead = await invoke(bare, "read", { path: "bare-native.txt", limit: 1 });
  assertNativePrompt(bareRead);
  assert.match(text(bareRead.result), /NATIVE_WITHOUT_PLUGINS/);
  assert.equal(await readFile(join(backingCwd, "bare-native.txt"), "utf8"), "NATIVE_WITHOUT_PLUGINS\n");
  assert.equal(await exists(`${targetCwd}/bare-native.txt`), false);
  const edit = await invoke(bare, "edit", { path: "bare-native.txt", oldText: "NATIVE_WITHOUT_PLUGINS", newText: "NATIVE_LAZY_REUSED" });
  assertNativePrompt(edit);
  const grep = await invoke(bare, "grep", { pattern: "NATIVE_LAZY_REUSED", path: ".", glob: "bare-native.txt", limit: 1 });
  assert.match(text(grep.result), /bare-native\.txt:1: NATIVE_LAZY_REUSED/);
  assert.equal(text((await invoke(bare, "find", { pattern: "bare-native.txt", path: "." })).result).trim(), "bare-native.txt");
  assert.match(text((await invoke(bare, "ls", { path: "." })).result), /bare-native\.txt/);
  assert.equal(text((await invoke(bare, "bash", { command: "printf NATIVE_LAZY_BASH" })).result), "NATIVE_LAZY_BASH");
  assertNativePrompt(await kernel(bare, 'assert lazy_native_sentinel == 7397\nprint("LAZY_NATIVE_RETAINED")'));
  assert.equal(generations.filter((entry) => entry.sessionId === bare).length, 1, "All seven native tools reuse one host generation");
  assert.equal(generations.findLast((entry) => entry.sessionId === bare).host, generation);
  assert.equal(generation.registration.pid, pid);
  assert(byteCounts.bare.opens > 0, "Native tools without plugins still use the real target channel/host");
  proof("native-host-without-plugins", { sessionId: bare, configuredPlugins: 0, pid, generation: generation.generation, channelOpens: byteCounts.bare.opens, coldAcrossSwitches: true, calls: nativeNames });

  const manifestPath = join(home, "assets", "manifest.json");
  const completeManifest = await readFile(manifestPath, "utf8");
  const missingFdManifest = JSON.parse(completeManifest);
  assert(missingFdManifest.tools.fd);
  delete missingFdManifest.tools.fd;
  await writeFile(manifestPath, JSON.stringify(missingFdManifest));
  try {
    const missing = (await client.request("createSession", { target: "bare" })).session.sessionId;
    await changeNative(missing, true);
    assert.equal(generations.some((entry) => entry.sessionId === missing), false, "Missing artifacts do not affect registration or switches");
    const refused = await invoke(missing, "write", { path: "missing-artifact-must-not-write.txt", content: "MUST_NOT_WRITE" }, true);
    assert.match(text(refused.result), /\bfd\b/);
    assert.equal(await exists(join(backingCwd, "missing-artifact-must-not-write.txt")), false, "Missing fd refuses startup before any native execution");
    assert.equal(generations.some((entry) => entry.sessionId === missing && entry.package === "Pi native tools"), false);
    proof("missing-native-artifact-refused", { sessionId: missing, artifact: "fd", message: text(refused.result), nativeHostStarted: false, failureAt: "first execute" });
  } finally {
    await writeFile(manifestPath, completeManifest);
  }
}
