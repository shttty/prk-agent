import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import test from "node:test";
import { parse } from "smol-toml";
import { gatewayFixture } from "../../fixtures/gateway/assemble-gateway.mjs";
import { freePort } from "../../fixtures/free-port.mjs";
import { until } from "../../fixtures/until.mjs";

const scrape = (port) => fetch(`http://127.0.0.1:${port}/metrics`);
const refused = (port) => assert.rejects(scrape(port), (error) => error.cause?.code === "ECONNREFUSED", `nothing listens on ${port}`);

async function occupy(t) {
  const port = await freePort();
  const server = createServer();
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return port;
}

async function webFixture(t, port) {
  const f = await gatewayFixture(t, { web: true, serveMetrics: true, config: { metrics: { port } } });
  const configPath = join(f.root, "config.toml");
  const call = (method, body) => fetch(`${f.url}/api/settings/metrics`, {
    method, headers: { Origin: f.url, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const saved = async () => ({ ...parse(await readFile(configPath, "utf8")).metrics });
  return { ...f, configPath, call, saved };
}

test("metrics settings apply to the running listener without a restart", async (t) => {
  const first = await freePort();
  const second = await freePort();
  const f = await webFixture(t, first);
  const lines = [];
  t.mock.method(console, "error", (...parts) => { lines.push(parts.join(" ")); });

  assert.deepEqual(await (await f.call("GET")).json(), { enabled: true, port: first, url: `http://127.0.0.1:${first}/metrics`, error: null });
  assert.equal((await scrape(first)).status, 200);

  for (const bad of [{ enabled: true, port: 80 }, { enabled: true, port: 1023 }, { enabled: true, port: 65_536 }, { enabled: true, port: 9500.5 },
    { enabled: true, port: "9500" }, { enabled: true }, { port: 9500 }, { enabled: true, port: 9500, host: "0.0.0.0" }]) {
    const response = await f.call("POST", bad);
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  assert.equal(existsSync(f.configPath), false, "a rejected request writes nothing");
  assert.equal((await scrape(first)).status, 200);

  const off = await f.call("POST", { enabled: false, port: first });
  assert.deepEqual(await off.json(), { enabled: false, port: first, url: null, error: null });
  await refused(first);
  assert.deepEqual(await f.saved(), { enabled: false, port: first });
  assert(lines.some((line) => /^\[\d{4}-\d\d-\d\dT[\d:.]+Z\] Gateway metrics off$/.test(line)), "the change is logged");

  const on = await f.call("POST", { enabled: true, port: first });
  assert.equal((await on.json()).url, `http://127.0.0.1:${first}/metrics`);
  assert.equal((await scrape(first)).status, 200);

  const moved = await f.call("POST", { enabled: true, port: second });
  assert.equal((await moved.json()).url, `http://127.0.0.1:${second}/metrics`);
  await refused(first);
  assert.equal((await scrape(second)).status, 200);
  assert.deepEqual(await f.saved(), { enabled: true, port: second });
});

test("a port that cannot be bound fails the change and leaves listener, answer and file as they were", async (t) => {
  const port = await freePort();
  const f = await webFixture(t, port);
  const busy = await occupy(t);
  await f.call("POST", { enabled: true, port });
  const before = await readFile(f.configPath, "utf8");

  const conflict = await f.call("POST", { enabled: true, port: busy });
  assert.equal(conflict.status, 409);
  const failure = await conflict.json();
  assert.equal(failure.code, "CONFLICT");
  assert.match(failure.error, new RegExp(`port ${busy} is already in use`));
  assert.equal(await readFile(f.configPath, "utf8"), before);
  assert.equal((await scrape(port)).status, 200, "the old listener keeps serving");
  assert.equal((await (await f.call("GET")).json()).port, port);

  await f.call("POST", { enabled: false, port });
  const closed = await readFile(f.configPath, "utf8");
  assert.equal((await f.call("POST", { enabled: true, port: busy })).status, 409);
  assert.equal(await readFile(f.configPath, "utf8"), closed);
  assert.deepEqual(await (await f.call("GET")).json(), { enabled: false, port, url: null, error: null });
  await refused(port);
});

test("a busy port at startup turns metrics off, logs it, reports it and can be changed away from", async (t) => {
  const busy = await occupy(t);
  const free = await freePort();
  const lines = [];
  t.mock.method(console, "error", (...parts) => { lines.push(parts.join(" ")); });
  const f = await webFixture(t, busy);

  const view = await (await f.call("GET")).json();
  assert.equal(view.enabled, true);
  assert.equal(view.url, null);
  assert.match(view.error, new RegExp(`port ${busy} is already in use`));
  await until(() => lines.find((line) => line.includes("ERROR Gateway metrics are off") && line.includes(String(busy))), "the startup failure is logged");

  const recovered = await (await f.call("POST", { enabled: true, port: free })).json();
  assert.deepEqual(recovered, { enabled: true, port: free, url: `http://127.0.0.1:${free}/metrics`, error: null });
  assert.equal((await scrape(free)).status, 200);
});
