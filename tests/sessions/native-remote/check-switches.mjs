import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkSwitches(fixture) {
  const { host, remote, changeNative, kernel, assertDeclared, text, nativeKernelAssertions, assertNativePrompt,
    proof, local, invoke, localCwd, events, generations } = fixture;
  const remoteSession = host.state(remote).sessionId;
  const remoteGeneration = generations.findLast((entry) => entry.sessionId === remote)?.host;
  const offSwitch = await changeNative(remote, false);
  const off = await kernel(remote, 'import sys\nassert native_switch_sentinel == 7391\nassert "prk_tools.files" in sys.modules\nassert all(callable(globals()[name]) for name in ["read", "edit", "write", "grep"])\nassert read("written.txt", limit=1)["lines"][0]["text"] == "NATIVE_DIRECT_WRITE"\nprint("REMOTE_PRK_FILES_MODE")');
  assertDeclared(off, false);
  assert.match(text(off.result), /REMOTE_PRK_FILES_MODE/);
  const onSwitch = await changeNative(remote, true);
  const on = await kernel(remote, `${nativeKernelAssertions}\nassert native_switch_sentinel == 7391\nassert "NATIVE_DIRECT_WRITE" in gateway.read(path="written.txt", limit=1)\nprint("REMOTE_NATIVE_MODE_RESTORED")`);
  assertNativePrompt(on);
  assert.equal(host.state(remote).sessionId, remoteSession);
  assert.equal(generations.findLast((entry) => entry.sessionId === remote)?.host, remoteGeneration, "Switches reuse the existing plugin/native target host");
  assert(host.state(remote).messages.some((message) => message.role === "toolResult" && message.toolName === "edit" && text(message).includes("NATIVE_PLUGIN_RESULT_DIAGNOSTIC")), "Switches preserve real SDK history");
  proof("same-session-native-on-off-on", { sessionId: remoteSession, streams: [offSwitch.before.streamId, offSwitch.after.streamId, onSwitch.after.streamId], effect: "next request declarations; immediate permission; no SDK/host/kernel replacement; Python variables retained" });

  await changeNative(local, true);
  const localOn = await kernel(local, `${nativeKernelAssertions}\nassert local_native_switch_sentinel == 7413\nassert "LOCAL_FILE_ORIGINAL" in gateway.read(path="local.txt", limit=1)\nprint("LOCAL_NATIVE_MODE")`);
  assertNativePrompt(localOn);
  const localWrite = await invoke(local, "write", { path: "local.txt", content: "LOCAL_NATIVE_WRITTEN\n" });
  assertNativePrompt(localWrite);
  assert.equal(await readFile(join(localCwd, "local.txt"), "utf8"), "LOCAL_NATIVE_WRITTEN\n");
  await changeNative(local, false);
  const localAgain = await kernel(local, 'import sys\nassert "prk_tools.files" in sys.modules\nassert local_native_switch_sentinel == 7413\nassert read("local.txt", limit=1)["lines"][0]["text"] == "LOCAL_NATIVE_WRITTEN"\nprint("LOCAL_FILES_MODE_RESTORED")');
  assertDeclared(localAgain, false);
  const localEvents = await events(localCwd);
  const localWrite = localEvents.find((entry) => entry.toolName === "write" && entry.phase === "tool_result");
  assert(localWrite);
  assert.notEqual(localWrite.pid, process.pid);
  assert(generations.some((entry) => entry.sessionId === local), "Local native tools and plugins share their independent session host");
  proof("local-native-files-mutual-exclusion", { directions: ["PRK files → Pi native", "Pi native → PRK files"], nativePid: localWrite.pid, filesRestored: true, variablesRetained: true });
  return localEvents;
}
