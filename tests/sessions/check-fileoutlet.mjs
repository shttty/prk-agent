import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import { stringify } from "smol-toml";
import { checkNativeToolsToggle } from "./fileoutlet/check-native-tools-toggle.mjs";
import { checkLocalHooks } from "./fileoutlet/check-local-hooks.mjs";
import { prepareOutletFixture } from "./fileoutlet/prepare-outlet-fixture.mjs";
// Owned Gateway/Pi/Jupyter/target channel/remote host with faux; no paid models or transport mocks.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";

assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN, "Only owned Jupyter fixtures are allowed");
assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required");
const runProcess = promisify(execFile);
try { await runProcess("bwrap", ["--version"]); }
catch (cause) { throw new Error("bwrap is required for target-only namespace acceptance", { cause }); }
const root = await mkdtemp(join(tmpdir(), "prk-fileoutlet-"));
const home = join(root, "gateway");
const previousHome = process.env.HOME;
process.env.HOME = join(root, "gateway-home");
const { agentDir, configPath } = initializePrkHome(home);
const text = (message) => typeof message?.content === "string" ? message.content
  : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const exists = (path) => access(path).then(() => true, () => false);
const proofs = [];
const proof = (name, details) => { proofs.push({ name, ...details }); console.log(JSON.stringify(proofs.at(-1))); };

try {
  await prepareNativeToolArtifacts(home);
  await mkdir(agentDir, { recursive: true });
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, getCurrentTools } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
  const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
  const { createTargetChannels } = await import("../../src/target-channel/channels/assemble-channels.ts");
  const { openProcessTransport } = await import("../../src/target-channel/process-transport/open.ts");

const { source, targetRoot, target, targetCwd, backingCwd, localCwd, gatewayCwd, wrapper, fileBytes, files, q } = await prepareOutletFixture({ root, exists });
await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source, enabled: true, location: "host" }], compaction: { enabled: false }, retry: { enabled: false }, defaultProjectTrust: "always" }));
  await withTargetFixture(async (remoteFixture) => {
    await withTargetFixture(async (localFixture) => {
      const document = { monitor: { enabled: false }, targetConnection: { startTimeoutMs: 15000 }, memory: { review: false },
        session: { noExtensions: false, bootstrapNoSkills: true, localTools: false, workerTools: "code", idleTimeoutMs: 600000 } };
      await writeFile(configPath, stringify(document));
      const configuration = parsePrkConfig(document);
      const targets = [
        executionTargetFromConfig({ ...remoteFixture.config, id: "remote", label: "Owned remote", local: false, sshCommand: remoteFixture.config.sshCommand, tags: [], cwd: targetCwd }),
        executionTargetFromConfig({ ...localFixture.config, id: "local", label: "Owned local", local: true, tags: [], cwd: localCwd }),
      ];
      const byteCounts = { remote: { sent: 0, received: 0, opens: 0 }, local: { sent: 0, received: 0, opens: 0 } };
      // Transparent decoration of the project's real transport seam: count actual UTF-8 pipe bytes,
      // not estimated request arguments. Bootstrap/bundle installation finishes before the measured edit.
      const channels = createTargetChannels({ options: { ...configuration.targetConnection, processWindow: configuration.processWindow }, async open(machine, signal, limits) {
        const selected = targets.find((entry) => entry.id === machine);
        assert(selected, machine);
        const fixture = selected.local ? localFixture : remoteFixture;
        const raw = await openProcessTransport(await fixture.runtime.acquire(), selected.python, selected.kernel.cwd, signal, configuration.targetConnection.startTimeoutMs, limits);
        const count = byteCounts[machine];
        count.opens++;
        return { command: "", transport: {
          write(data) { count.sent += Buffer.byteLength(data, "utf8"); raw.write(data); },
          onData(listener) { raw.onData((data) => { count.received += Buffer.byteLength(data, "utf8"); listener(data); }); },
          onClose(listener) { raw.onClose(listener); },
          close() { return raw.close(); },
        } };
      } });
      const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const provider = fauxProvider({ provider: "fileoutlet-controlled", models: [{ id: "controlled" }], tokensPerSecond: 100000 });
      modelRuntime.registerNativeProvider(provider.provider);
      const generations = [];
      const host = await createGatewayHost({ cwd: gatewayCwd, home, noSkills: true, historyDir: join(home, "history"),
        model: "fileoutlet-controlled/controlled", thinkingLevel: "off", config: configuration, targets }, {
        runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: gatewayCwd, agentDir, targetChannels: channels },
        onRemoteExtensionGeneration(generation, context) { generations.push({ ...context, host: generation }); },
      });
      localFixture.onCleanup(() => host.close());
      const endpoint = await startGateway(host, join(root, "gateway.sock"));
      localFixture.onCleanup(() => endpoint.close());
      const client = await connectGateway(join(root, "gateway.sock"));
      localFixture.onCleanup(() => client.disconnect());
      const remote = (await client.request("createSession", { target: "remote" })).session.sessionId;
      const remoteGeneration = generations.findLast((entry) => entry.sessionId === remote && entry.package === source)?.host;
      assert(remoteGeneration, "The fixture must load in a real remote extension host");
      assert.notEqual(remoteGeneration.registration.pid, process.pid);
      assert.deepEqual((await host.pluginsList()).packages.filter((pkg) => pkg.error), []);
      const events = async (cwd) => (await readFile(join(cwd, "fileoutlet-events.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
      const invoke = async (worker, name, args) => {
        const id = randomUUID();
        const declarations = [];
        let result;
        provider.setResponses([
          (context) => { declarations.push(getCurrentTools(context.messages).map((tool) => tool.name)); return fauxAssistantMessage(fauxToolCall(name, args, { id }), { stopReason: "toolUse" }); },
          (context) => { declarations.push(getCurrentTools(context.messages).map((tool) => tool.name)); result = context.messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === id); return fauxAssistantMessage("Observed file outlet result."); },
        ]);
        const admission = await host.nativeSend(worker, { sessionId: worker, requestId: randomUUID(), message: "Exercise owned file outlet", mode: "plain" });
        assert.equal(admission.accepted, true, JSON.stringify(admission));
        assert.equal((await admission.completion).status, "completed");
        assert(result, "The next real provider request must contain the native tool outcome");
        assert.equal(result.isError, false, text(result));
        return { result, declarations };
      };
      const kernel = (code, worker = remote) => invoke(worker, "kernel_code", { code, title: "File outlet acceptance" });
      const native = async (worker, action, args) => {
        const result = await client.request("nativeAction", { sessionId: worker, requestId: randomUUID(), action, ...(args ? { args } : {}) });
        assert.equal(result.status, "completed", JSON.stringify(result));
        return result.data;
      };
      const fileNames = ["read", "edit", "write"];
      const assertDeclared = (declarations, enabled) => {
        assert(declarations.length > 0);
        for (const tools of declarations) for (const name of fileNames) assert.equal(tools.includes(name), enabled, `${name} model declaration must follow the native-tools toggle`);
      };

      const metadata = await kernel(`page = read("metadata.txt", offset=2, limit=2)\nassert [row["text"] for row in page["lines"]] == ["METADATA_SECOND", "METADATA_THIRD"]\nprint(page)`);
      assertDeclared(metadata.declarations, false);
      assert.match(text(metadata.result), /METADATA_SECOND/);
      assert.match(text(metadata.result), /FILEOUTLET_READ_DIAGNOSTIC/);
      const firstEvents = await events(backingCwd);
      const readCall = firstEvents.find((entry) => entry.phase === "tool_call" && entry.toolName === "read");
      assert.deepEqual(readCall.input, { path: `${targetCwd}/metadata.txt`, offset: 2, limit: 2 });
      assert.equal(readCall.pid, remoteGeneration.registration.pid);
      assert.equal(readCall.cwd, targetCwd);
      assert.match(readCall.toolCallId, /\/\d+$/);
      const readResult = firstEvents.find((entry) => entry.phase === "tool_result" && entry.toolName === "read");
      assert.equal(readResult.content.length, 1, "Kernel reads emit one notice, not a second file-content read");
      assert.equal(readResult.content[0].type, "text");
      assert.doesNotMatch(text(readResult), /METADATA_SECOND|METADATA_THIRD/);
      proof("remote-kernel-read-metadata", { pid: readCall.pid, gatewayPid: process.pid, input: readCall.input, nestedId: readCall.toolCallId });

      const replacedRead = await kernel('print(read("replacement-read.txt", limit=1))');
      assert.match(text(replacedRead.result), /KERNEL_PAGE_REMAINS_AUTHORITATIVE/);
      assert.match(text(replacedRead.result), /FILEOUTLET_READ_REPLACEMENT/);
      proof("remote-read-replacement-appended", { kernelPagePreserved: true, replacementAppended: true });

      const blocked = await kernel(`blocked_view = read("blocked.txt", limit=1)\nblocked_ref = blocked_view["lines"][0]["ref"]\ntry:\n    edit("blocked.txt", [{"op":"replace", "start":blocked_ref, "end":blocked_ref, "text":"MUST_NOT_BE_WRITTEN"}])\nexcept ValueError as error:\n    assert "FILEOUTLET_EDIT_DENIED" in str(error)\n    print(error)\nelse:\n    raise AssertionError("The plugin did not block the kernel edit")`);
      assert.match(text(blocked.result), /FILEOUTLET_EDIT_DENIED/);
      assert.equal(await readFile(join(backingCwd, "blocked.txt"), "utf8"), files["blocked.txt"]);
      const mutated = await kernel(`mutation_view = read("mutate.txt", limit=1)\nmutation_ref = mutation_view["lines"][0]["ref"]\nprint(edit("mutate.txt", [{"op":"replace", "start":mutation_ref, "end":mutation_ref, "text":"MODEL_REQUESTED_TEXT"}]))`);
      assert.match(text(mutated.result), /MUTATED_BY_PLUGIN/);
      assert.equal(await readFile(join(backingCwd, "mutate.txt"), "utf8"), "MUTATED_BY_PLUGIN\n");
      const diagnosed = await kernel(`diagnostic_view = read("diagnosed.txt", limit=1)\ndiagnostic_ref = diagnostic_view["lines"][0]["ref"]\nprint(edit("diagnosed.txt", [{"op":"replace", "start":diagnostic_ref, "end":diagnostic_ref, "text":"DIAGNOSED_CHANGED"}]))`);
      assert.match(text(diagnosed.result), /FILEOUTLET_EDIT_DIAGNOSTIC/);
      assert.equal(await readFile(join(backingCwd, "diagnosed.txt"), "utf8"), "DIAGNOSED_CHANGED\n");
      const diagnosedEvent = (await events(backingCwd)).findLast((entry) => entry.phase === "tool_result" && entry.toolName === "edit" && entry.input.path.endsWith("/diagnosed.txt"));
      assert.equal(typeof diagnosedEvent.details.diff, "string");
      assert.equal(typeof diagnosedEvent.details.patch, "string");
      assert.equal(diagnosedEvent.details.firstChangedLine, 1);
      assert.match(diagnosedEvent.details.hash, /^[a-f0-9]{64}$/);
      proof("remote-kernel-plugin-hooks", { blockedReasonVisible: true, mutationWritten: "MUTATED_BY_PLUGIN", diagnosticVisible: true, nativeDetails: Object.keys(diagnosedEvent.details).sort() });

      const formatted = await kernel(`format_view = read("formatted.txt", limit=2)\nformat_ref = format_view["lines"][0]["ref"]\nformat_result = edit("formatted.txt", [{"op":"replace", "start":format_ref, "end":format_ref, "text":"UNFORMATTED_BY_MODEL"}])\nassert format_result["formatted"] is True, format_result\nformatted_row = next(row for row in format_result["diff"] if row["kind"] == "+" and row["text"] == "FORMATTED_BY_PLUGIN")\nformatted_ref = formatted_row["ref"]\nprint(format_result)\nprint("FORMATTED_REFERENCE", formatted_ref)`);
      assert.match(text(formatted.result), /FORMATTED_BY_PLUGIN/);
      assert.match(text(formatted.result), /FILEOUTLET_FORMAT_DIAGNOSTIC/);
      assert.match(text(formatted.result), /FORMATTED_REFERENCE 1#[a-f0-9]{3}/);
      assert.equal(await readFile(join(backingCwd, "formatted.txt"), "utf8"), "FORMATTED_BY_PLUGIN\nstable\n");
      // No read between these cells: the returned post-formatter reference must already authorize the next edit.
      const secondEdit = await kernel(`print(edit("formatted.txt", [{"op":"replace", "start":formatted_ref, "end":formatted_ref, "text":"SECOND_EDIT_SUCCESS"}]))`);
      assert.match(text(secondEdit.result), /SECOND_EDIT_SUCCESS/);
      assert.equal(await readFile(join(backingCwd, "formatted.txt"), "utf8"), "SECOND_EDIT_SUCCESS\nstable\n");
      proof("remote-post-hook-formatting", { formattedReference: text(formatted.result).match(/FORMATTED_REFERENCE (1#[a-f0-9]{3})/)[1], nextEditWithoutRead: true });

      await kernel('large_view = read("large.txt", limit=1)\nlarge_ref = large_view["lines"][0]["ref"]\nassert large_view["lines"][0]["text"] == "LARGE_OLD"');
      const before = { ...byteCounts.remote };
      const largeEdit = await kernel('print(edit("large.txt", [{"op":"replace", "start":large_ref, "end":large_ref, "text":"LARGE_CHANGED"}]))');
      const transferred = { sent: byteCounts.remote.sent - before.sent, received: byteCounts.remote.received - before.received };
      const totalBytes = transferred.sent + transferred.received;
      assert(transferred.sent > 0 && transferred.received > 0, "Accounting must observe the real target channel in both directions");
      assert.equal(byteCounts.remote.opens, before.opens, "The byte interval must not include a replacement transport/bootstrap");
      assert(totalBytes < 256 * 1024 && totalBytes < fileBytes / 20, JSON.stringify({ fileBytes, ...transferred, totalBytes }));
      assert.match(text(largeEdit.result), /LARGE_CHANGED/);
      await kernel('from pathlib import Path\nwith Path("large.txt").open("rb") as actual_large:\n    assert actual_large.readline() == b"LARGE_CHANGED\\n"\nassert Path("large.txt").stat().st_size >= 5 * 1024 * 1024\nprint("LARGE_TARGET_EDIT_CONFIRMED")');
      proof("large-edit-channel-bytes", { fileBytes, ...transferred, totalBytes, fractionOfFile: totalBytes / fileBytes, measurement: "actual UTF-8 TargetTransport pipe bytes, both directions" });

      const kernelWrite = await kernel('print(write("direct.txt", "KERNEL_WRITTEN\\n"))');
      assertDeclared(kernelWrite.declarations, false);
      assert.equal(await readFile(join(backingCwd, "direct.txt"), "utf8"), "KERNEL_WRITTEN\n");
      const writeCall = (await events(backingCwd)).findLast((entry) => entry.phase === "tool_call" && entry.toolName === "write");
      assert.deepEqual(writeCall.input, { path: `${targetCwd}/direct.txt`, content: "KERNEL_WRITTEN\n" });
      assert.equal(writeCall.pid, remoteGeneration.registration.pid);
      assert.match(writeCall.toolCallId, /\/\d+$/);
      proof("remote-kernel-write", { pid: writeCall.pid, nestedId: writeCall.toolCallId, path: writeCall.input.path });

      await checkNativeToolsToggle({ remote, native, invoke, assertDeclared, backingCwd, gatewayCwd, targetCwd, exists, kernel, text, proof, fileNames });

const localEvents = await checkLocalHooks({ client, kernel, text, localCwd, events, generations, proof });
      if (process.env.PRK_FILEOUTLET_EVIDENCE) {
        const evidence = resolve(process.env.PRK_FILEOUTLET_EVIDENCE);
        await mkdir(evidence, { recursive: true });
        await writeFile(join(evidence, "fileoutlet-proof.json"), JSON.stringify({ proofs, targetEvents: await events(backingCwd), localEvents }, null, 2) + "\n");
      }
      console.log("PASS fileoutlet: real remote/native kernel hooks, blocked/mutated/diagnosed/formatted edits, fresh refs, bounded 5MiB channel traffic, native-tool toggle, and local native hooks");
    }, { tempParent: root, allowHidden: true, rootDir: () => "/" });
  }, { sshCommand: q(wrapper), tempParent: root });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
