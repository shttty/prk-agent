import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request } from "node:http";
import { test } from "node:test";
import { WebSocket, WebSocketServer } from "ws";
import { startWebDev } from "../fixtures/web-dev.mjs";

function post(url, host, origin) {
  return new Promise((resolve, reject) => {
    const req = request(`${url}/api/origin`, {
      method: "POST", headers: { host, ...(origin === undefined ? {} : { origin }) },
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function socketOrigin(url, host, origin) {
  const socket = new WebSocket(`${url.replace("http:", "ws:")}/api/origin`, { headers: { host }, origin });
  try {
    const [message] = await once(socket, "message");
    return message.toString();
  } finally {
    socket.terminate();
    await once(socket, "close");
  }
}

test("Vite HTTPS proxy preserves cross-site origins and enforces configured hosts", { timeout: 10_000 }, async () => {
  const backend = createServer((req, res) => res.end(req.headers.origin ?? "<absent>"));
  const sockets = new WebSocketServer({ server: backend });
  sockets.on("connection", (socket, req) => socket.send(req.headers.origin ?? "<absent>"));
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const api = `http://127.0.0.1:${backend.address().port}`;
  const savedHosts = process.env.PRK_ALLOWED_HOSTS;
  const tailHost = "phone.tailnet-example.ts.net";
  let ui;
  try {
    process.env.PRK_ALLOWED_HOSTS = "";
    ui = await startWebDev(api);
    const localHost = new URL(ui.url).host;
    assert.deepEqual(await post(ui.url, localHost, `https://${localHost}`), { status: 200, body: api });
    assert.deepEqual(await post(ui.url, localHost, `http://${localHost}`), { status: 200, body: api });
    assert.equal((await post(ui.url, tailHost, `https://${tailHost}`)).status, 403);
    await ui.close();

    process.env.PRK_ALLOWED_HOSTS = ` unused.example, ${tailHost}, , `;
    ui = await startWebDev(api);
    for (const [origin, expected] of [
      [`https://${tailHost}`, api],
      [`http://${tailHost}`, api],
      ["https://evil.example", "https://evil.example"],
      [`https://${tailHost}:444`, `https://${tailHost}:444`],
      [`ftp://${tailHost}`, `ftp://${tailHost}`],
      ["null", "null"],
      ["not-a-url", "not-a-url"],
      [undefined, "<absent>"],
    ]) {
      assert.deepEqual(await post(ui.url, tailHost, origin), { status: 200, body: expected }, String(origin));
    }
    assert.equal((await post(ui.url, "unlisted.example", "https://unlisted.example")).status, 403);
    for (const origin of [`https://${tailHost}`, `http://${tailHost}`, "https://evil.example"]) {
      assert.equal(await socketOrigin(ui.url, tailHost, origin), origin.includes("evil.example") ? origin : api);
    }
  } finally {
    if (savedHosts === undefined) delete process.env.PRK_ALLOWED_HOSTS;
    else process.env.PRK_ALLOWED_HOSTS = savedHosts;
    await ui?.close();
    sockets.close();
    await new Promise((resolve) => backend.close(resolve));
  }
});
