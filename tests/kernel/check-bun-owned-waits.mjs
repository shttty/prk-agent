import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createSocket } from "node:dgram";
import { createServer } from "node:net";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { withBunOwner, text } from "./fixtures/create-bun-owner.mjs";
import { DEFAULT_KERNEL_EXECUTION_POLICY } from "../../src/kernel/kernel-options.ts";

if (!process.argv.includes("--isolated")) {
  const root = await mkdtemp(join(tmpdir(), "prk-bdns-"));
  try {
    const env = { ...process.env, HOME: root, PRK_HOME: join(root, "prk"), TMPDIR: join(root, "t") };
    await mkdir(env.TMPDIR);
    await writeFile(join(root, "resolv"), "nameserver 127.0.0.1\noptions timeout:2 attempts:4\n");
    const child = spawnSync("unshare", ["-Urnm", "--", "/bin/sh", "-ec", `
      mount --bind "$1/resolv" /etc/resolv.conf
      ip link set lo up
      exec "$2" "$3" --isolated`, "fixture", root, process.execPath, fileURLToPath(import.meta.url)], { env, stdio: "inherit", timeout: 35000 });
    assert.ifError(child.error);
    assert.equal(child.status, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
} else await check();

async function check() {
  const dns = createSocket("udp4");
  const names = new Map();
  dns.on("message", (packet, peer) => names.set(packet.subarray(13, 13 + packet[12]).toString(), { packet, peer }));
  await new Promise((resolve) => dns.bind(53, "127.0.0.1", resolve));
  const sockets = [];
  const tcp = createServer((socket) => {
    const connection = { socket, closed: false };
    sockets.push(connection);
    socket.on("close", () => { connection.closed = true; });
    socket.on("error", () => {});
    socket.on("data", (data) => {
      if (data.toString().startsWith("GET /body")) socket.write("HTTP/1.1 200 OK\r\nContent-Length: 9\r\n\r\nabc");
    });
  });
  await new Promise((resolve) => tcp.listen(0, "127.0.0.1", resolve));
  const port = tcp.address().port;
  try {
    await withBunOwner(async (owner) => {
      const started = new Map();
      const finished = new Map();
      const sdk = { tools: [], async executeTool(_, { tag }) { started.get(tag).resolve(); return { result: { content: [] } }; } };
      owner.subscribeFinished((event) => finished.set(event.cellId, event.result));
      async function launch(tag, code) {
        const ready = Promise.withResolvers();
        started.set(tag, ready);
        const result = await owner.tool.execute(tag, { yield_s: 0, code }, undefined, undefined, sdk);
        const { cell_id: id } = JSON.parse(text(result));
        assert(id);
        return { id, ready: ready.promise };
      }
      async function stop(cell) {
        const result = await owner.requestCellInterrupt(cell.id, "never");
        assert.equal(result.details?.outcome, "aborted", JSON.stringify(result));
        return text(result);
      }
      const wrapped = (tag, body) => `try { ${body} } catch(e) { console.log(e.code ?? e.name); } finally { console.log('${tag}-finally'); }`;
      const signal = (tag) => `await gateway.call('ready', {tag: '${tag}'});`;
      for (const [kind, body] of [
        ["sleep", (tag) => `${signal(tag)} await cell.sleep(60000);`],
        ["tcp", (tag) => `const sock = await cell.connect({host:'127.0.0.1',port:${port}}); ${signal(tag)} await new Promise(r => sock.once('close',r));`],
        ["headers", (tag) => `${signal(tag)} await cell.fetch('http://127.0.0.1:${port}/silent');`],
        ["body", (tag) => `const response = await cell.fetch('http://127.0.0.1:${port}/body'); ${signal(tag)} await response.text();`],
        ["dns", (tag) => `${signal(tag)} await cell.resolve('${tag}.test', 'A');`],
      ]) {
        const base = sockets.length;
        const kernelId = owner.getSnapshot().kernelId;
        const a = await launch(`${kind}a`, wrapped("A", body(`${kind}a`)));
        const b = await launch(`${kind}b`, wrapped("B", body(`${kind}b`)));
        await until(() => Promise.race([Promise.all([a.ready, b.ready]).then(() => true), delay(10, false)]));
        const network = ["tcp", "headers", "body"].includes(kind);
        if (network) await until(() => sockets.length === base + 2);
        if (kind === "dns") await until(() => names.has("dnsa") && names.has("dnsb"));
        const result = await stop(a);
        assert.match(result, /A-finally/);
        if (kind === "dns") assert.match(result, /ECANCELLED/);
        if (network) await until(() => sockets.slice(base).filter(({ closed }) => closed).length === 1);
        assert.equal(finished.has(b.id), false);
        assert(owner.getSnapshot().activeCells.some(({ cellId }) => cellId === b.id));
        assert.match(await stop(b), /B-finally/);
        if (network) await until(() => sockets.slice(base).every(({ closed }) => closed));
        if (kernelId) assert.equal(owner.getSnapshot().kernelId, kernelId);
      }
      const raw = await launch("raw", wrapped("raw", `const dns = await import('node:dns/promises'); ${signal("raw")} await dns.lookup('raw.test', {family:4});`));
      await until(() => names.has("raw"));
      const pending = await owner.requestCellInterrupt(raw.id, "never");
      assert.equal(pending.status, "stopping");
      assert.equal(finished.has(raw.id), false);
      const { packet, peer } = names.get("raw");
      packet.writeUInt16BE(0x8183, 2); // NXDOMAIN, with the original question.
      dns.send(packet, peer.port, peer.address);
      await until(() => finished.has(raw.id));
      assert.equal(finished.get(raw.id).details.outcome, "aborted");
      assert.match(text(finished.get(raw.id)), /raw-finally/);
    }, { executionPolicy: () => ({ ...DEFAULT_KERNEL_EXECUTION_POLICY, interruptTimeoutMs: 250 }) });
  } finally {
    for (const { socket } of sockets) socket.destroy();
    await new Promise((resolve) => tcp.close(resolve));
    dns.close();
  }
  console.log("PASS: timer, TCP, fetch headers/body, private DNS, and original lookup settlement");
}

async function until(ready) {
  const limit = Date.now() + 2500;
  while (!(await ready())) { assert(Date.now() < limit, "fixture did not observe expected operation"); await delay(10); }
}
