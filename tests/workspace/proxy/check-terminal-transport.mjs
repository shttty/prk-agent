import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WebSocket } from "ws";

export async function checkTerminalTransport({ sessionId: worker, post, socketUrl, connect, attached, until, cwd, client, options, api }) {
  // Terminal I/O is one WebSocket now: the per-key POST, resize/open POST and the SSE endpoint are gone.
  await post(worker, "terminals/input", { name: "shell", data: "x" }, 404);
  await post(worker, "terminals/open", { name: "shell" }, 404);
  assert.equal((await fetch(api(worker, "terminals/shell/events"))).status, 404);
  for (const headers of [{ Origin: "https://foreign.invalid" }, {}]) {
    const rejected = new WebSocket(socketUrl(worker, "shell"), { headers });
    assert.equal(await new Promise((resolve) => { rejected.on("unexpected-response", (_request, response) => resolve(response.statusCode)); rejected.on("error", () => {}); }), 403, "A socket without the exact workbench Origin never reaches a shell");
  }

  const one = connect(worker);
  assert.equal((await attached(one, "first terminal snapshot")).connectionStatus, "connected");
  one.type("echo hi\r");
  await until(() => one.output().includes("\nhi\n"), "real echo hi output");
  one.type("pwd\r");
  await until(() => one.output().includes(`\n${cwd}\n`), "terminal starts in worker cwd");
  const two = connect(worker);
  await attached(two, "second terminal snapshot");
  one.type("echo BOTH_SUBSCRIBERS\r");
  await until(() => one.output().includes("\nBOTH_SUBSCRIBERS\n") && two.output().includes("\nBOTH_SUBSCRIBERS\n"), "terminal fans out to both subscribers");

  // Keystrokes pipeline in order: 300 one-character messages sent back to back arrive as exactly that sequence.
  const sequence = Array.from({ length: 300 }, (_, index) => "abcdefghijklmnopqrstuvwxyz0123456789"[(index * 7) % 36]).join("");
  one.type("echo ");
  for (const character of sequence) one.type(character);
  one.type("\r");
  await until(() => one.output().includes(`\n${sequence}\n`), "burst of single-character inputs echoes in order");
  // A 10 KB paste is one message and lands byte for byte.
  const pasted = Array.from({ length: 200 }, (_, index) => `${String(index).padStart(3, "0")}-${randomUUID().replaceAll("-", "").slice(0, 45)}`).join("\n") + "\n";
  one.type("cat > pasted.txt\r");
  await new Promise((resolve) => setTimeout(resolve, 200));
  one.type(pasted.replaceAll("\n", "\r"));
  await until(() => one.output().includes(pasted.split("\n").at(-2)), "paste echoed");
  one.type("\u0004");
  await until(async () => (await readFile(join(cwd, "pasted.txt"), "utf8").catch(() => "")) === pasted, "10 KB paste written completely and in order");
  one.close(); two.close();
  await Promise.all([one.read, two.read]);

  const writer = connect(worker);
  await attached(writer, "writer snapshot");
  writer.type(`printf '${"界".repeat(800)}REPLAY_TAIL\\n'\r`);
  let replay;
  await until(async () => {
    replay = (await client.request("subscribeTerminal", { sessionId: worker, name: "shell" })).replay;
    await client.request("unsubscribeTerminal");
    return replay.includes("REPLAY_TAIL\r\n");
  }, "output retained without browsers");
  writer.close();
  await writer.read;
  let reattached = connect(worker);
  const snapshot = await attached(reattached, "reattach snapshot");
  assert(snapshot.replay.includes("REPLAY_TAIL\r\n"));
  assert(Buffer.byteLength(snapshot.replay) <= options.workspace.terminalReplayBytes);
  assert(!snapshot.replay.includes("\ufffd"), "Replay truncation never splits UTF-8 characters");
  reattached.send({ type: "resize", rows: 31, cols: 97 });
  reattached.type("stty size\r");
  await until(() => reattached.output().includes("\n31 97\n"), "resize changes actual terminal dimensions");
  reattached.send({ type: "ping" });
  await until(() => reattached.frames.some((frame) => frame.type === "pong"), "application ping is answered");
  for (const invalid of ["{", '{"type":"input"}', '{"type":"resize","rows":0,"cols":1}', '{"type":"input","data":"x","extra":1}']) {
    const bad = connect(worker);
    await attached(bad, "invalid message probe attached");
    bad.ws.send(invalid);
    await bad.read;
    assert.equal(bad.code, 1008, `Malformed message is refused: ${invalid}`);
  }

return reattached;
}
