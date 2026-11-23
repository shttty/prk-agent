import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { buildNativeToolHost } from "../../src/remote-extensions/bundle/build-native-tool-host.ts";
import { request } from "../../src/remote-extensions/generation/requests/request.ts";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { observeProcesses } from "./runtime-channel/observe-processes.mjs";
import { createHostFixture } from "./host/create-host-fixture.mjs";
import { DEFAULT_REMOTE_HOST_OPTIONS } from "../../src/config/remote-host/remote-host-options.ts";

assert(process.env.PI_TEST_PYTHON);
assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN);
const home = await mkdtemp(join(tmpdir(), "prk-S5-store-"));
const store = new ArtifactStore(join(home, "assets"));
const modes = process.argv[2] === "all" ? ["local", "office"] : [process.argv[2] ?? "local"];
const runtime = process.argv[3] ?? DEFAULT_REMOTE_HOST_OPTIONS.runtime;
assert(["node", "bun"].includes(runtime));
const stage = (phase, details = {}) => console.log(JSON.stringify({ phase, time: new Date().toISOString(), runtime, ...details }));
const text = (result) => result.content.filter((entry) => entry.type === "text").map((entry) => entry.text).join("\n");
try {
  stage("prepare-artifacts");
  await prepareNativeToolArtifacts(home);
  const artifacts = await buildNativeToolHost({ store, platform: process.arch === "x64" ? "x86_64" : "aarch64" });
  for (const mode of modes) {
    const owned = await createHostFixture(mode, store, artifacts);
    const hosts = [];
    let identity;
    try {
      const plugin = await owned.write("plugin.mjs", `export default function(pi) {
        pi.registerTool({name:'s5_echo',label:'echo',description:'Owned payload probe',parameters:{type:'object',properties:{text:{type:'string'}},required:['text']},
          execute:async(_id,args)=>({content:[{type:'text',text:args.text}],details:{pid:process.pid,cwd:process.cwd(),offline:process.env.PI_OFFLINE}})});
        pi.registerTool({name:'s5_emit',label:'emit',description:'Owned event probe',parameters:{type:'object',properties:{}},
          execute:async()=>{pi.events.emit('s5-bus','shared');return {content:[{type:'text',text:'sent'}]}}});
      }`);
      const peer = await owned.write("peer.mjs", `export default function(pi) {
        let observed='empty'; pi.events.on('s5-bus',value=>{observed=value});
        pi.registerTool({name:'s5_observe',label:'observe',description:'Owned bus peer',parameters:{type:'object',properties:{}},
          execute:async()=>({content:[{type:'text',text:observed}],details:{pid:process.pid}})});
      }`);
      stage("cold-host-start", { mode, root: owned.fixture.root });
      const first = owned.open([plugin, peer], runtime);
      const registration = await first.start();
      hosts.push(registration.pid);
      stage("host-ready", { mode, pid: registration.pid, identity: await owned.identity() });
      assert.notEqual(registration.pid, process.pid);
      assert(registration.packages.every((pkg) => !pkg.error), JSON.stringify(registration.packages));
      const nativeNames = registration.tools.filter((tool) => tool.piNativeTool).map((tool) => tool.name).sort();
      assert.deepEqual(nativeNames, ["bash", "edit", "find", "grep", "ls", "read", "write"]);
      let revision = 0;
      const call = async (host, name, args) => {
        const tool = host.registration.tools.find((entry) => entry.name === name);
        assert(tool, name);
        const result = await request(host, "execute", { toolId: tool.toolId, toolCallId: randomUUID(), args,
          snapshot: { revision: ++revision, cwd: owned.fixture.root, projectTrusted: true, sessionId: host.generation,
            activeTools: host.registration.tools.map((entry) => entry.name), isIdle: true, hasPendingMessages: false, systemPrompt: "" } });
        assert(!result.isError, JSON.stringify(result));
        return result;
      };
      await call(first, "write", { path: "native.txt", content: "first line\nneedle\n" });
      assert.match(text(await call(first, "read", { path: "native.txt" })), /first line/);
      await call(first, "edit", { path: "native.txt", edits: [{ oldText: "first line", newText: "changed line" }] });
      assert.match(text(await call(first, "grep", { pattern: "changed", path: "native.txt" })), /changed/);
      assert.match(text(await call(first, "find", { pattern: "native.txt", path: "." })), /native.txt/);
      assert.match(text(await call(first, "ls", { path: "." })), /native.txt/);
      assert.match(text(await call(first, "bash", { command: "printf 'S5_NATIVE_BASH'" })), /S5_NATIVE_BASH/);
      await call(first, "s5_emit", {});
      assert.equal(text(await call(first, "s5_observe", {})), "shared");
      const body = "λ\n".repeat(1800000);
      const large = call(first, "s5_echo", { text: body });
      await assert.rejects(call(first, "s5_observe", {}), { code: "BUSY" });
      const echoed = await large;
      assert.equal(text(echoed), body);
      assert.equal(echoed.details.pid, registration.pid);
      assert.equal(echoed.details.cwd, owned.fixture.root);
      assert.equal(echoed.details.offline, "1");
      stage("tools-and-payload-complete", { mode });
      const second = owned.open([peer], runtime);
      const secondRegistration = await second.start();
      hosts.push(secondRegistration.pid);
      assert.notEqual(secondRegistration.pid, registration.pid);
      assert.equal(text(await call(second, "s5_observe", {})), "empty");
      await first.close();
      assert.match(text(await call(second, "read", { path: "native.txt" })), /changed line/);
      identity = await owned.identity();
      await second.close();
      await observeProcesses(owned.fixture, [...hosts, identity.pid, identity.child, identity.daemon], { gone: true });
      console.log(JSON.stringify({ mode, status: "PASS", nativeNames, sharedBus: true, isolatedHosts: hosts,
        bytes: Buffer.byteLength(body), concurrentFrame: "BUSY", identity, runtime, piVersion: "1.6.0" }));
    } finally { await owned.close(); }
  }
} finally { await rm(home, { recursive: true, force: true }); }
