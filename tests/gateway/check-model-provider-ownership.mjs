import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { checkProviderBrowser } from "../fixtures/model-providers/check-browser.mjs";

const root = await mkdtemp(join(tmpdir(), "prk-owner-"));
const previousHome = process.env.HOME;
process.env.HOME = join(root, "user");
const modelConfig = (id) => ({ baseUrl: "http://127.0.0.1:1/v1", apiKey: "fixture-only", api: "openai-responses", models: [{ id, name: id, input: ["text"], reasoning: false, contextWindow: 4096, maxTokens: 128, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] });
const ai = new URL("../../node_modules/@earendil-works/pi-ai/dist/index.js", import.meta.url).href;
async function packageAt(name, source) {
  const directory = join(root, name);
  await mkdir(directory);
  await writeFile(join(directory, "package.json"), JSON.stringify({ name, type: "module", pi: { extensions: ["index.ts"] } }));
  await writeFile(join(directory, "index.ts"), source);
  return directory;
}
async function ownHost(home, config, model, targets = []) {
  initializePrkHome(home);
  const host = await createGatewayHost({ cwd: home, home, config: parsePrkConfig(config), model, thinkingLevel: "off", targets });
  const gateway = await startGateway(host, join(home, "g.sock"));
  const web = await startWebApplication({ socket: join(home, "g.sock"), host: "127.0.0.1", port: 0 });
  return { host, web, async close() { await web.close(); await gateway.close(); await host.close(); } };
}
try {
  const manualHome = join(root, "manual");
  await mkdir(join(manualHome, "agent"), { recursive: true });
  await writeFile(join(manualHome, "agent/models.json"), JSON.stringify({ providers: { clp: modelConfig("manual-only") } }));
  const manual = await ownHost(manualHome, { session: { noExtensions: true }, memory: { review: false } }, "clp/manual-only");
  try {
    const response = await fetch(`${manual.web.server.url}/api/models`);
    assert.equal(response.status, 200);
    assert.ok((await response.json()).models.some(({ value }) => value === "clp/manual-only"));
    console.log("PASS models.json-only /api/models through real HTTP/socket/Gateway");
  } finally { await manual.close(); }

  const first = await packageAt("first-provider", `import { writeFileSync } from 'node:fs';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from ${JSON.stringify(ai)};
export default (pi) => {
 const provider = fauxProvider({provider:'gateway-fixture',models:[{id:'controlled'}],tokensPerSecond:100000});
 provider.setResponses([fauxAssistantMessage(fauxToolCall('ownership_tool',{}),{stopReason:'toolUse'}),fauxAssistantMessage('tool survived')]);
 pi.registerProvider(provider.provider);
 pi.registerProvider('owned-background',${JSON.stringify(modelConfig("initial"))});
 const timer = setTimeout(()=>{pi.unregisterProvider('owned-background');pi.registerProvider('owned-background',${JSON.stringify(modelConfig("updated"))});},500);
 timer.unref(); pi.on('session_shutdown',()=>clearTimeout(timer));
 pi.registerTool({name:'ownership_tool',label:'Ownership tool',description:'Retained real tool',parameters:{type:'object',properties:{}},async execute(){return {content:[{type:'text',text:'OWNERSHIP_TOOL_EXECUTED'}]};}});
 pi.registerCommand('ownership-inspect',{handler:async(args,ctx)=>{
  if(args==='mutate') {pi.registerProvider('session-intruder',${JSON.stringify(modelConfig("intruder"))});pi.unregisterProvider('clp');}
  writeFileSync(${JSON.stringify(join(root, "inspect-"))}+ctx.sessionManager.getSessionId()+'.json',JSON.stringify(ctx.modelRegistry.getAll().map(m=>m.provider+'/'+m.id)));
 }});
 pi.on('session_start',(_event,ctx)=>{if(ctx.mode==='tui')pi.registerProvider('session-start-intruder',${JSON.stringify(modelConfig("intruder"))});});
};`);
  const second = await packageAt("second-provider", `export default pi=>{pi.registerProvider('gateway-fixture',${JSON.stringify(modelConfig("stolen"))});pi.registerProvider('clp',${JSON.stringify(modelConfig("plugin-clp"))});pi.registerCommand('conflict-survivor',{handler:async()=>{}});};`);
  const home = join(root, "runtime");
  await mkdir(join(home, "agent"), { recursive: true });
  await writeFile(join(home, "agent/settings.json"), JSON.stringify({ packages: [first, second] }));
  await writeFile(join(home, "agent/models.json"), JSON.stringify({ providers: { clp: modelConfig("manual-only") } }));
  await withTargetFixture(async ({ config }) => {
    const owned = await ownHost(home, { session: { noExtensions: false, workerTools: "direct", localTools: true, idleTimeoutMs: 60000 }, memory: { review: false } }, "gateway-fixture/controlled", [executionTargetFromConfig({ ...config, id: "fixture", label: "Fixture", local: true, tags: [], cwd: home })]);
    try {
      const models = async () => {
        const response = await fetch(`${owned.web.server.url}/api/models`);
        assert.equal(response.status, 200);
        return (await response.json()).models.map(({ value }) => value).sort();
      };
      const initial = await models();
      assert.ok(initial.includes("gateway-fixture/controlled"));
      assert.ok(initial.includes("clp/manual-only"));
      assert.ok(!initial.includes("gateway-fixture/stolen"));
      assert.ok(!initial.includes("clp/plugin-clp"));
      const global = await owned.host.capabilitiesList();
      assert.ok(global.catalog.providerErrors.some(({ providerId }) => providerId === "clp"));
      assert.ok(global.catalog.providerErrors.some(({ providerId }) => providerId === "gateway-fixture"));
      const create = async () => (await owned.host.createSession({ target: "fixture", cwd: home })).session.sessionId;
      const a = await create(), b = await create();
      const send = async (id, message) => {
        const submitted = await owned.host.session(id).submit({ requestId: crypto.randomUUID(), message });
        assert.equal(submitted.accepted, true);
        assert.equal((await submitted.completion).status, "completed");
      };
      const native = owned.host.nativeCapabilities(a);
      assert.ok(native.resources.some(({ providers }) => providers?.includes("gateway-fixture")));
      assert.ok(native.resources.some(({ code, providerId, loaded }) => code === "PROVIDER_POLICY" && providerId === "session-start-intruder" && loaded));
      assert.ok(native.commands.some(({ name }) => name === "conflict-survivor"));
      await send(a, "Exercise the retained ownership tool.");
      assert.ok(JSON.stringify(owned.host.state(a)).includes("OWNERSHIP_TOOL_EXECUTED"));
      await send(a, "/ownership-inspect mutate");
      await send(b, "/ownership-inspect");
      const inspect = async (id) => JSON.parse(await readFile(join(root, `inspect-${id}.json`), "utf8"));
      for (const list of [await models(), await inspect(a), await inspect(b)]) {
        assert.ok(!list.some((value) => value.startsWith("session-intruder/") || value.startsWith("session-start-intruder/")));
        assert.ok(list.includes("clp/manual-only"));
      }
      const deadline = Date.now() + 5000;
      while (!(await models()).includes("owned-background/updated")) {
        assert.ok(Date.now() < deadline, "Gateway owner background re-registration did not update shared models");
        await delay(25);
      }
      assert.ok(!(await models()).includes("owned-background/initial"));
      console.log("PASS ownership: automatic packages, manual-ID priority, first-package wins, policy diagnostics, real tool, A/B isolation, Gateway background update");
      if (process.argv.includes("--browser")) await checkProviderBrowser(owned.web.server.url, a, process.env.PI_TEST_WEB_EVIDENCE);
    } finally { await owned.close(); }
  }, { tempParent: root, allowHidden: true });
} finally {
  if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
