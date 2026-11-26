import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { until } from "../../fixtures/until.mjs";
import { startMetricsListener } from "../../../src/metrics/endpoint/start-metrics-listener.ts";

const BUSY_MS = 300;

/** Gateway-side plugin package whose before_agent_start busy-waits only for a prompt that asks for it. */
async function writeSlowPlugin(t) {
  const directory = await mkdtemp(join(tmpdir(), "stall-probe-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "package.json"), JSON.stringify({ name: "stall-probe", version: "1.0.0", type: "module", pi: { extensions: ["./index.js"] } }));
  await writeFile(join(directory, "index.js"), `export default (pi) => {
    pi.on("before_agent_start", async (event) => {
      if (!event.prompt.includes("slow")) return;
      const until = performance.now() + ${BUSY_MS};
      while (performance.now() < until);
    });
  };`);
  return directory;
}

/** Value of the series `name` whose labels include all of `labels`; 0 when it does not exist yet. */
function sample(body, name, labels = {}) {
  for (const line of body.split("\n")) {
    const match = /^([a-z_:0-9]+)(?:\{(.*)\})? (\S+)$/.exec(line);
    if (!match || match[1] !== name) continue;
    const present = Object.fromEntries([...(match[2] ?? "").matchAll(/(\w+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    if (Object.entries(labels).every(([key, value]) => present[key] === value)) return Number(match[3]);
  }
  return 0;
}

test("Gateway metrics: a normal turn is quiet, a blocking plugin hook is attributed and logged", async (t) => {
  const plugin = await writeSlowPlugin(t);
  const f = await gatewayFixture(t, {
    config: { metrics: { eventLoopWindowMs: 200 }, session: { noExtensions: false } },
    settings: { packages: [{ source: plugin, enabled: true, location: "gateway" }] },
  });
  await f.stageArtifacts();
  const listener = await startMetricsListener(0);
  t.after(() => listener.close());
  const scrape = async () => {
    const response = await fetch(`http://127.0.0.1:${listener.port}/metrics`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/plain/);
    return response.text();
  };
  const lines = [];
  t.mock.method(console, "error", (...parts) => { lines.push(parts.join(" ")); });
  const stalls = () => lines.filter((line) => line.includes("Gateway stall"));
  const slow = { plugin: "stall-probe", event: "before_agent_start" };

  const id = await f.create();
  assert.equal((await f.complete(id, await f.send(id, "Hello"))).status, "completed");
  await until(async () => sample(await scrape(), "prk_eventloop_window_max_seconds_count") > 0, "an event-loop window");
  const quiet = await scrape();
  assert.deepEqual(stalls(), [], "a normal turn must not log a stall");
  assert.equal(sample(quiet, "prk_plugin_hook_sync_seconds_count", slow), 1);
  assert.equal(sample(quiet, "prk_sessions", { state: "idle" }), 1);
  assert.equal(sample(quiet, "prk_model_requests_in_flight", { provider: "verification" }), 0);
  assert.equal(sample(quiet, "prk_model_request_seconds_count", { provider: "verification", outcome: "ok" }), 1);
  assert(sample(quiet, "prk_serialization_bytes_count", { kind: "frame_response" }) > 0);
  assert(quiet.includes("# TYPE nodejs_eventloop_lag_seconds gauge") && sample(quiet, "process_cpu_user_seconds_total") > 0);
  assert(!quiet.includes(id), "no series may carry a session id");
  const slowWindowsBefore = sample(quiet, "prk_eventloop_window_max_seconds_count") - sample(quiet, "prk_eventloop_window_max_seconds_bucket", { le: "0.2" });

  assert.equal((await f.complete(id, await f.send(id, "Please be slow"))).status, "completed");
  const hookLine = await until(() => stalls().find((line) => line.includes("kind=plugin_hook")), "plugin stall line");
  assert.match(hookLine, new RegExp(`^\\[\\d{4}-\\d\\d-\\d\\dT[\\d:.]+Z\\] WARN Gateway stall kind=plugin_hook plugin="stall-probe" event=before_agent_start sessionId=${id} durationMs=3\\d\\d bytes=-$`));
  const loopLine = await until(() => stalls().find((line) => line.includes("kind=event_loop")), "event-loop stall line");
  assert.match(loopLine, /WARN Gateway stall kind=event_loop sessionId=- durationMs=\d+ bytes=- p99Ms=\d+ windowMs=200$/);

  const body = await scrape();
  assert.equal(sample(body, "prk_plugin_hook_sync_seconds_count", slow), 2);
  assert(sample(body, "prk_plugin_hook_sync_seconds_sum", slow) >= BUSY_MS / 1000);
  assert.equal(sample(body, "prk_plugin_hook_sync_seconds_bucket", { ...slow, le: "0.2" }), 1);
  assert.equal(sample(body, "prk_plugin_hook_sync_seconds_bucket", { ...slow, le: "0.5" }), 2);
  const slowWindows = sample(body, "prk_eventloop_window_max_seconds_count") - sample(body, "prk_eventloop_window_max_seconds_bucket", { le: "0.2" });
  assert(slowWindows > slowWindowsBefore, "an event-loop window above the 200 ms threshold was recorded");
  assert.equal(sample(body, "prk_stalls_total", { kind: "plugin_hook" }), 1);
  assert(sample(body, "prk_stalls_total", { kind: "event_loop" }) >= 1);
  t.diagnostic(["--- stall log ---", ...stalls(), "--- /metrics ---", ...body.split("\n").filter((line) =>
    /^prk_(plugin_hook_sync_seconds_(count|sum)\{plugin="stall-probe"|eventloop_(delay|utilization)|eventloop_window_max_seconds_(count|sum)|stalls_total|sessions\{state="(idle|running)"|model_request)/.test(line)
    || /^nodejs_eventloop_lag_(max|p99)/.test(line))].join("\n"));
});

test("the endpoint binds 127.0.0.1 only and serves nothing but GET /metrics", async (t) => {
  const listener = await startMetricsListener(0);
  t.after(() => listener.close());
  assert.equal(listener.address, "127.0.0.1");
  const base = `http://127.0.0.1:${listener.port}`;
  assert.equal((await fetch(`${base}/other`)).status, 404);
  const post = await fetch(`${base}/metrics`, { method: "POST" });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get("allow"), "GET");
  const external = Object.values(networkInterfaces()).flat().find((entry) => entry && entry.family === "IPv4" && !entry.internal);
  if (!external) return t.diagnostic("no non-loopback IPv4 interface to probe");
  const refused = await new Promise((resolve) => {
    const socket = connect({ host: external.address, port: listener.port });
    socket.once("connect", () => { socket.destroy(); resolve("connected"); });
    socket.once("error", (error) => resolve(error.code));
  });
  assert.equal(refused, "ECONNREFUSED");
});
