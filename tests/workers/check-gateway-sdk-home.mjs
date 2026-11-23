import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { connectGateway } from "../../src/gateway/socket-client/connect-client.ts";

const entry = fileURLToPath(new URL("../../src/main.ts", import.meta.url));
const provider = fileURLToPath(new URL("../fixtures/gateway-test-provider.mjs", import.meta.url));
const probe = fileURLToPath(new URL("../fixtures/gateway-sdk-home-probe.mjs", import.meta.url));
const root = await mkdtemp(join(tmpdir(), "prk-sdk-home-"));
const fakeHome = join(root, "empty-home");
const home = join(root, "prk-home");
const agentDir = join(home, "agent");
const socket = join(root, "gateway.sock");
const recordPath = join(root, "sdk-home.json");
let child, client, exited;
let stderr = "";

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
async function bounded(promise, description, ms = 15000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out: ${description}; Gateway stderr=${stderr}`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}
async function stopChild() {
  if (!child) return;
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    try { await exited; } finally { clearTimeout(timer); }
  } else await exited;
}

try {
  await mkdir(fakeHome);
  await mkdir(agentDir, { recursive: true });
  assert.equal(await exists(join(fakeHome, ".pi")), false);
  const env = {
    ...process.env, HOME: fakeHome, PRK_HOME: join(root, "wrong-prk-home"),
    XDG_CONFIG_HOME: join(root, "xdg-config"), XDG_CACHE_HOME: join(root, "xdg-cache"), XDG_DATA_HOME: join(root, "xdg-data"),
    PI_CODING_AGENT_DIR: join(root, "bogus-inherited-agent"), PRK_CODING_AGENT_DIR: join(root, "bogus-inherited-prk-agent"), PI_OFFLINE: "1", PRK_SDK_HOME_PROBE_PATH: recordPath,
  };
  child = spawn(process.execPath, [entry, "gateway", "--home", home, "--socket", socket,
    "--model", "gateway-check/controlled", "--no-skills", "--extension", provider, "--extension", probe], {
    cwd: root, env, stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-100000); });
  // Resolve errors too, so cleanup always awaits the owned process without an unhandled rejection.
  exited = new Promise((resolve) => {
    child.once("error", (error) => resolve({ error }));
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  let exitResult;
  void exited.then((result) => { exitResult = result; });
  const deadline = Date.now() + 15000;
  while (!await exists(socket)) {
    if (exitResult) throw new Error(`Gateway exited before readiness: ${JSON.stringify(exitResult)}; stderr=${stderr}`);
    if (Date.now() >= deadline) throw new Error(`Timed out: Gateway socket readiness; stderr=${stderr}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  client = await connectGateway(socket);
  // modelCatalog reaches runtimeBase -> createAgentSessionServices and loads both
  // explicit extensions, without allocating a session/kernel or generating tokens.
  const catalog = await bounded(client.request("modelCatalog"), "lazy SDK services and extensions");
  assert(catalog.models.some((model) => model.value === "gateway-check/controlled"), "The public controlled provider was actually loaded");
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  assert.equal(record.gatewayPid, child.pid, "The extension observed the real Gateway process");
  assert.equal(record.sdkAgentDir, agentDir, "Public SDK getAgentDir() must resolve the explicit PRK home, not inherited Pi configuration");
  assert.equal(record.configDirName, ".prk", "The embedded SDK is rebranded: project resources live in .prk/, not .pi/");
  assert.equal(record.envAgentDir, agentDir, "Gateway must override inherited PRK_CODING_AGENT_DIR before loading extensions");
  assert.equal(record.child.agentDir, agentDir, "An owned child spawned inside Gateway inherits its selected agent directory");
  assert.equal(record.child.piAgentDir, agentDir, "A stock pi CLI spawned inside Gateway also lands in the PRK agent directory");
  assert.notEqual(record.child.pid, record.gatewayPid);
  assert.equal(await exists(join(fakeHome, ".pi")), false, "SDK initialization must not create fake HOME/.pi");
  assert.equal(await exists(join(fakeHome, ".prk")), false, "SDK initialization must not create fake HOME/.prk");
  assert.deepEqual(await bounded(client.request("shutdown"), "graceful Gateway shutdown"), { closed: true });
  assert.deepEqual(await bounded(exited, "Gateway exit"), { code: 0, signal: null }, stderr);
  assert.equal(await exists(socket), false, "Graceful shutdown removes the owned listener");
  assert.equal(await exists(join(fakeHome, ".pi")), false, "Shutdown must not create fake HOME/.pi");
  console.log("PASS Gateway SDK home: explicit --home overrides inherited Pi directory in public extension lookups and owned child inheritance; no HOME/.pi, no model calls, graceful shutdown");
} finally {
  client?.disconnect();
  try { await stopChild(); }
  finally { await rm(root, { recursive: true, force: true }); }
}
