import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";

const root = await mkdtemp(join(tmpdir(), "prk-host-preflight-"));
const previous = { HOME: process.env.HOME, PRK_HOME: process.env.PRK_HOME };
process.env.HOME = join(root, "user");
const home = process.env.PRK_HOME = join(root, "home");
const { agentDir } = initializePrkHome(home);
const contacted = join(root, "target-contacted");
const loaded = join(root, "factory-pids");
const hook = join(root, "session-hook");
let host, gateway, web;
try {
  await mkdir(process.env.HOME, { recursive: true });
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { owned: { baseUrl: "http://127.0.0.1:1/v1", apiKey: "unused", api: "openai-responses", models: [{ id: "manual", name: "manual", input: ["text"], reasoning: false, contextWindow: 4096, maxTokens: 128, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  await writeFile(join(agentDir, "settings.json"), "{}\n");
  const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, session: { noExtensions: false, noSkills: true, bootstrapNoSkills: true } }, { instances: [
    { id: "remote", label: "Remote-only preflight", local: false, sshCommand: `printf contacted > '${contacted}'; exit 93`, python: "/usr/bin/python3", cwd: root },
  ] });
  host = await createGatewayHost({ cwd: home, home, config, targets: config.instances, model: "owned/manual", thinkingLevel: "off" });
  const socket = join(home, "g.sock");
  gateway = await startGateway(host, socket);
  web = await startWebApplication({ socket, home, host: "127.0.0.1", port: 0 });
  const api = async (path, body) => {
    const response = await fetch(`${web.server.url}/api${path}`, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json", origin: web.server.url }, body: JSON.stringify(body) });
    const value = await response.json();
    console.log(JSON.stringify({ path, status: response.status, value }));
    return { status: response.status, value };
  };
  const source = join(root, "ordinary");
  const unsupported = join(root, "unsupported");
  const provider = join(root, "provider");
  for (const [directory, name] of [[source, "ordinary"], [unsupported, "unsupported"], [provider, "provider"]]) {
    await mkdir(directory);
    await writeFile(join(directory, "package.json"), JSON.stringify({ name: `@prk-tests/${name}`, type: "module", pi: { extensions: ["index.mjs"] } }));
  }
  await writeFile(join(source, "index.mjs"), `import {appendFileSync,writeFileSync} from 'node:fs'; export default pi => {
    appendFileSync(${JSON.stringify(loaded)}, process.pid + '\\n');
    pi.on('session_start', () => writeFileSync(${JSON.stringify(hook)}, 'start'));
    pi.on('session_shutdown', () => writeFileSync(${JSON.stringify(hook)}, 'shutdown'));
    pi.registerCommand('preflight_command', {handler: async () => writeFileSync(${JSON.stringify(hook)}, 'command')});
  };`);
  await writeFile(join(unsupported, "index.mjs"), `export default pi => pi.registerTool({name:'sync_probe',label:'Probe',description:'Probe',parameters:{type:'object',properties:{}},prepareArguments(args){return args;},async execute(){return {content:[]};}});`);
  await writeFile(join(provider, "index.mjs"), `export default pi => pi.registerProvider('preflight-provider', {baseUrl:'http://127.0.0.1:1',apiKey:'unused',api:'openai-responses',models:[]});`);
  const installed = await api("/plugins/install", { source, location: "host" });
  assert.equal(installed.status, 200);
  assert.equal(installed.value.packages[0].installedPath, source);
  assert.equal(installed.value.packages[0].location, "host");
  assert.equal((await api("/plugins/change", { source, enabled: false })).value.packages[0].enabled, false);
  assert.equal((await api("/plugins/change", { source, enabled: true })).value.packages[0].enabled, true);
  assert((await readFile(loaded, "utf8")).trim().split("\n").every((pid) => Number(pid) !== process.pid), "host preflight never executes its factory in Gateway");
  assert(!existsSync(hook), "registration preflight never executes session hooks or commands");
  assert.equal((await api("/plugins/change", { source, location: "gateway" })).status, 200);
  await writeFile(loaded, "");
  assert.equal((await api("/plugins/change", { source, location: "host" })).status, 200);
  assert((await readFile(loaded, "utf8")).trim().split("\n").every((pid) => Number(pid) !== process.pid));
  const rejected = await api("/plugins/install", { source: unsupported, location: "host" });
  assert.equal(rejected.value.code, "UNSUPPORTED");
  assert.equal(rejected.value.details.member, "tool.prepareArguments");
  assert.equal((await api("/plugins/install", { source: unsupported, location: "gateway" })).status, 200);
  const moved = await api("/plugins/change", { source: unsupported, location: "host" });
  assert.equal(moved.value.code, "UNSUPPORTED");
  assert.equal(moved.value.details.member, "tool.prepareArguments");
  const providerRejected = await api("/plugins/install", { source: provider, location: "host" });
  assert.equal(providerRejected.value.code, "PROVIDER_POLICY");
  assert.equal(providerRejected.value.details.providerErrors[0].providerId, "preflight-provider");
  const listed = await api("/plugins");
  assert.equal(listed.value.packages.find((pkg) => pkg.source === unsupported).location, "gateway");
  assert(!listed.value.packages.some((pkg) => pkg.source === provider));
  assert(!existsSync(contacted), "remote-only CRUD never connects or secretly transfers artifacts");
  const environment = await api("/targets/remote/environment");
  assert.equal(environment.value.status, "idle");
  assert.equal(environment.value.transferredBytes, 0);
  assert.deepEqual(host.workbench().sessions, []);
  assert.equal((await api("/plugins/uninstall", { source, confirm: true })).status, 200);
  assert.equal((await api("/plugins/uninstall", { source: unsupported, confirm: true })).status, 200);
  assert(existsSync(join(source, "index.mjs")));
  console.log("PASS remote-only HTTP CRUD/location: isolated registration, no Gateway double load, no target connection/transfer/session/hooks, structured provider and synchronous-member rejection");
} finally {
  await web?.close();
  if (gateway) await gateway.close(); else await host?.close();
  for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(root, { recursive: true, force: true });
}
