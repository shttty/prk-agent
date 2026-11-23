// POST /api/gateway/restart against real systemd user units started by this test (never the production units):
// the unit's MainPID changes, a Gateway frozen in a synchronous loop is restarted too, an unconfigured unit and a
// cross-site request are refused, and the Gateway client is never used.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { startWebServer } from "../../src/http/listener/start-listener.ts";

const run = promisify(execFile);
const suffix = randomBytes(4).toString("hex");
const units = [];

async function systemctl(...args) {
  try { return (await run("systemctl", ["--user", ...args])).stdout.trim(); }
  catch (error) { return `${error.stdout ?? ""}`.trim(); }
}
async function startUnit(name, script) {
  const unit = `prk-test-gw-${name}-${suffix}`;
  units.push(unit);
  // TimeoutStopSec keeps the SIGTERM-ignoring loop's SIGKILL escalation short.
  await run("systemd-run", ["--user", "--quiet", `--unit=${unit}`, "--collect", "-p", "TimeoutStopSec=2", process.execPath, "-e", script]);
  return unit;
}
const mainPid = async (unit) => Number(await systemctl("show", "-p", "MainPID", "--value", unit));
const activeState = (unit) => systemctl("show", "-p", "ActiveState", "--value", unit);

// Any use of the Gateway client fails the test: the restart must not go through the Gateway.
const gatewayCalls = [];
const gateway = new Proxy({}, { get: (_target, name) => () => { gatewayCalls.push(String(name)); return Promise.reject(new Error("Gateway must not be used")); } });

const servers = [];
async function serve(gatewayRestart) {
  const server = await startWebServer(gateway, { host: "127.0.0.1", port: 0, gatewayRestart });
  servers.push(server);
  return server;
}
const post = (server, headers = {}) => fetch(`${server.url}/api/gateway/restart`, { method: "POST", headers: { "Content-Type": "application/json", Origin: server.url, ...headers }, body: "{}" });

try {
  const healthy = await startUnit("ok", "setInterval(() => {}, 1000)");
  const frozen = await startUnit("spin", 'process.on("SIGTERM", () => {}); while (true) {}');
  const [healthyBefore, frozenBefore] = await Promise.all([mainPid(healthy), mainPid(frozen)]);
  assert(healthyBefore > 0 && frozenBefore > 0);
  // Let node reach the loop with its SIGTERM handler installed, so the stop really needs SIGKILL.
  await sleep(1000);

  // (a) a running unit gets a new main process.
  const web = await serve({ unit: healthy, timeoutMs: 30_000 });
  const ui = await (await fetch(`${web.url}/api/ui`)).json();
  assert.equal(ui.gatewayRestartUnit, healthy);
  const ok = await post(web);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).restarted, true);
  const healthyAfter = await mainPid(healthy);
  assert(healthyAfter > 0 && healthyAfter !== healthyBefore, "restart must replace the main process");
  assert.equal(await activeState(healthy), "active");

  // (b) a Gateway stuck in `while(true){}` that ignores SIGTERM is still restarted.
  const frozenWeb = await serve({ unit: frozen, timeoutMs: 30_000 });
  const frozenResponse = await post(frozenWeb);
  assert.equal(frozenResponse.status, 200);
  const frozenAfter = await mainPid(frozen);
  assert(frozenAfter > 0 && frozenAfter !== frozenBefore, "a frozen unit must be restarted too");
  assert.equal(await activeState(frozen), "active");

  // systemctl failure is reported with its exit code; the deadline reports an unknown outcome.
  const missing = await post(await serve({ unit: `prk-test-gw-missing-${suffix}`, timeoutMs: 30_000 }));
  assert.equal(missing.status, 502);
  const failure = await missing.json();
  assert.equal(failure.code, "SYSTEMCTL_FAILED");
  assert.equal(typeof failure.details.exitCode, "number");
  await sleep(1000);
  const slow = await post(await serve({ unit: frozen, timeoutMs: 300 }));
  assert.equal(slow.status, 504);
  assert.equal((await slow.json()).code, "SYSTEMCTL_TIMEOUT");

  // (c) unconfigured: explicit refusal, nothing restarted; cross-site and malformed requests are refused before systemctl.
  const bare = await serve({ unit: "", timeoutMs: 30_000 });
  assert.equal((await (await fetch(`${bare.url}/api/ui`)).json()).gatewayRestartUnit, null);
  const unconfigured = await post(bare);
  assert.equal(unconfigured.status, 409);
  assert.equal((await unconfigured.json()).code, "NOT_CONFIGURED");
  const settled = await mainPid(healthy);
  assert.equal((await post(web, { Origin: "http://evil.example" })).status, 403);
  assert.equal((await fetch(`${web.url}/api/gateway/restart`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await post(web, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await fetch(`${web.url}/api/gateway/restart`, { method: "POST", headers: { "Content-Type": "application/json", Origin: web.url }, body: '{"unit":"x"}' })).status, 400);
  assert.equal((await fetch(`${web.url}/api/gateway/restart`, { headers: { Origin: web.url } })).status, 405);
  assert.equal(await mainPid(healthy), settled, "refused requests must not restart the unit");

  assert.deepEqual(gatewayCalls, []);
  console.log("PASS Gateway restart: systemd unit restarted by the web process (also while frozen), failures and unconfigured reported, cross-site refused, Gateway untouched");
} finally {
  await Promise.all(servers.map((server) => server.close().catch(() => {})));
  for (const unit of units) { await systemctl("stop", unit); await systemctl("reset-failed", unit); }
  const left = (await systemctl("list-units", `prk-test-gw-*-${suffix}.service`, "--all", "--no-legend")).trim();
  if (left) console.error(`Temporary units remain:\n${left}`);
}
