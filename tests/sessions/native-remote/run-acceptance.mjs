import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { checkTargetTools } from "./check-target-tools.mjs";
import { checkSwitches } from "./check-switches.mjs";
import { checkLazyHost } from "./check-lazy-host.mjs";

export async function runAcceptance(fixture) {
  const { host, client, provider, getCurrentTools, getCurrentSystemMessage, getSystemMessageText,
    fauxAssistantMessage, fauxToolCall, text, nativeNames, fileHelpers, localCwd, backingCwd, proofs } = fixture;
  const events = async (cwd) => (await readFile(join(cwd, "native-remote-events.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  const invoke = async (worker, name, args, expectError = false) => {
    const id = randomUUID();
    const requests = [];
    let result;
    const capture = (context) => requests.push({ tools: getCurrentTools(context.messages).map((tool) => tool.name),
      declarations: getCurrentTools(context.messages), prompt: getSystemMessageText(getCurrentSystemMessage(context.messages)) });
    provider.setResponses([
      (context) => { capture(context); return fauxAssistantMessage(fauxToolCall(name, args, { id }), { stopReason: "toolUse" }); },
      (context) => { capture(context); result = context.messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === id); return fauxAssistantMessage("Observed native acceptance operation."); },
    ]);
    const admission = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: "Exercise owned native fixture", mode: "plain" });
    assert.equal(admission.accepted, true, JSON.stringify(admission));
    assert.equal((await admission.completion).status, "completed");
    assert(result, "The real provider follow-up must contain this tool outcome");
    assert.equal(result.isError, expectError, text(result));
    return { result, requests };
  };
  const kernel = (worker, code) => invoke(worker, "kernel_code", { code, title: "Native remote acceptance" });
  const native = async (worker, action, args) => {
    const result = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
    assert.equal(result.status, "completed", JSON.stringify(result));
    return result.data;
  };
  const current = async (worker) => (await client.request("nativeCapabilities", { sessionId: worker })).target.current;
  const assertDeclared = (run, enabled) => {
    assert(run.requests.length > 0);
    for (const request of run.requests) for (const name of nativeNames) {
      assert.equal(request.tools.includes(name), enabled, `Native ${name} declaration follows the current switch`);
    }
  };
  const changeNative = async (worker, enabled) => {
    const before = host.state(worker);
    await native(worker, "local-tools", { enabled });
    assert.equal((await current(worker)).localTools, enabled, "The existing action saves the switch immediately");
    assert.equal((await current(worker)).requiresReload, false, "Switching native permissions never requires reload");
    const after = host.state(worker);
    assert.equal(after.streamId, before.streamId, "A switch never replaces the SDK generation");
    assert.equal(after.sessionId, before.sessionId);
    assert.equal(after.kernel.kernelId, before.kernel.kernelId, "A switch never replaces the kernel");
    return { before, after };
  };
  const local = (await client.request("createSession", { target: "local" })).session.sessionId;
  const localOff = await kernel(local, 'import sys\nassert "prk_tools.files" in sys.modules\nassert all(callable(globals()[name]) for name in ["read", "edit", "write", "grep"])\nlocal_page = read("local.txt", limit=1)\nassert local_page["lines"][0]["text"] == "LOCAL_FILE_ORIGINAL"\nlocal_native_switch_sentinel = 7413\nprint("LOCAL_FILES_MODE")');
  assertDeclared(localOff, false);
  const fileEntries = (await native(local, "capabilities")).entries.filter((entry) => entry.module === "files" && !entry.moduleOnly);
  assert.equal(fileEntries.length, fileHelpers.length, "The off-mode kernel loads all four PRK file helpers");
  const fileDescriptions = fileEntries.map((entry) => entry.description).filter(Boolean);
  assert.equal(fileDescriptions.length, fileHelpers.length);
  const assertNativePrompt = (run) => {
    assertDeclared(run, true);
    for (const request of run.requests) {
      const advertised = request.prompt + JSON.stringify(request.declarations);
      assert(!advertised.includes("prk_tools.files"));
      for (const description of fileDescriptions) assert(!advertised.includes(description), "Native mode must not advertise the PRK file helper descriptions");
    }
  };
  const nativeKernelAssertions = `import sys\nassert "prk_tools.files" in sys.modules\nassert all(callable(globals()[name]) for name in ${JSON.stringify(fileHelpers)})\ntry:\n    read("content.txt", limit=1)\nexcept Exception as native_files_denied:\n    assert 'Kernel function "read" is disabled for this session.' in str(native_files_denied), str(native_files_denied)\nelse:\n    raise AssertionError("Native mode must refuse the resident PRK file helper")\nassert all(callable(globals()[name]) for name in ["bash", "glob", "ls", "tool_bin"])\ndescribed = gateway.describe()\nassert set(${JSON.stringify(nativeNames)}) <= {entry["name"] for entry in described}\nedit_properties = gateway.describe("edit")["parameters"]["properties"]\nassert "edits" in edit_properties and "operations" not in edit_properties`;
  const shared = { ...fixture, events, invoke, kernel, native, current, assertDeclared, changeNative, assertNativePrompt, nativeKernelAssertions, local };
  await checkLazyHost(shared);
  await host.pluginsInstall({ source: fixture.pkg.source, location: "host" });
  await native(local, "reload");
  const remote = await checkTargetTools(shared);
  const localEvents = await checkSwitches({ ...shared, remote });
  if (process.env.PRK_NATIVE_REMOTE_EVIDENCE) {
    const evidence = resolve(process.env.PRK_NATIVE_REMOTE_EVIDENCE);
    assert(!evidence.includes("/.config/pi-remote-kernel"), "Evidence must not target production PRK home");
    await mkdir(evidence, { recursive: true });
    await writeFile(join(evidence, "native-remote-proof.json"), JSON.stringify({ proofs, targetEvents: await events(backingCwd), localEvents }, null, 2) + "\n");
  }
  console.log("PASS native remote: seven target-only Pi tools, fuzzy/image semantics, plugin hooks, native callbacks, bounded 5MiB transfers, offline imported rg/fd, same-session switches and lazy native-only host");
}
