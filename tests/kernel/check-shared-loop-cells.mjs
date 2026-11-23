import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers/promises";
import { kernelPrelude } from "../../src/codemode/kernel-prelude/build-prelude.ts";
import { buildForkserver } from "../../src/kernel/forkserver/build-forkserver.ts";
import { DEFAULT_KERNEL_RUNTIME_OPTIONS } from "../../src/kernel/kernel-options.ts";
import { readPythonSource } from "../../src/target-channel/deployment-source/read-python-source.ts";

const python = process.env.PI_TEST_PYTHON;
assert(python && isAbsolute(python), "PI_TEST_PYTHON must name the absolute owned test interpreter");
const home = await mkdtemp("/tmp/prk-loop-");
const generation = crypto.randomUUID();
const processWindow = { maxRequests: 8, maxBytes: 2 ** 21, maxFrameBytes: 2 ** 20 };
const kernel = new URL("../../src/kernel/", import.meta.url);
const bootstrap = readFileSync(new URL("process/bootstrap.py", kernel), "utf8");
const child = spawn(python, ["-I", "-u", "-c", bootstrap, String(processWindow.maxFrameBytes)], {
  cwd: home, env: { ...process.env, HOME: home, PRK_HOME: home, TMPDIR: home }, stdio: ["pipe", "pipe", "pipe"],
});
const closed = once(child, "close");
const frames = [];
let stderr = "", requestId = 0;
child.stderr.setEncoding("utf8").on("data", (text) => { stderr += text; });
createInterface({ input: child.stdout }).on("line", (line) => frames.push(JSON.parse(line)));
const send = (frame) => child.stdin.write(`${JSON.stringify(frame)}\n`);
const command = (cellId, kind, fields) => {
  const id = ++requestId;
  send({ generation, cellId, id, kind, ...fields });
  return id;
};
const execute = (cellId, code, mode) => command(cellId, "execute", { title: cellId, code, defaultCellMode: "thread", mode });
const select = (cellId, kind) => frames.filter((frame) => frame.cellId === cellId && frame.kind === kind);
const output = (cellId, stream = "stdout") => select(cellId, "stream").filter((frame) => frame.stream === stream).map(({ text }) => text).join("");
const wait = async (pick, label) => {
  const deadline = performance.now() + 5000;
  for (;;) {
    const found = pick();
    if (found) return found;
    assert(performance.now() < deadline,
      `${label}: ${stderr}\n${JSON.stringify(frames.filter(({ kind }) => kind !== "display" && kind !== "callback_chunk"))}`);
    await setTimeout(5);
  }
};
const ended = async (cellId, re, outcome = "ok") => {
  const frame = await wait(() => select(cellId, "cell_end")[0] ?? select(cellId, "rejected")[0], `${cellId} terminal`);
  assert.deepEqual(frame, { generation, cellId, kind: "cell_end", re, outcome });
};
const callback = async (cellId, expected) => {
  await wait(() => select(cellId, "callback_chunk").some(({ final }) => final), `${cellId} callback`);
  const chunks = select(cellId, "callback_chunk");
  assert(chunks.length > 1);
  for (const [i, frame] of chunks.entries()) {
    const { data, ...header } = frame;
    assert.deepEqual(header, { generation, cellId, kind: "callback_chunk", channel: "gateway", requestId: 1, final: i === chunks.length - 1 });
  }
  assert.deepEqual(JSON.parse(Buffer.concat(chunks.map(({ data }) => Buffer.from(data, "base64"))).toString()), expected);
};
const reply = async (cellId, bytes, final) => {
  const re = command(cellId, "callback_reply_chunk", { requestId: 1, final, data: Buffer.from(bytes).toString("base64") });
  await wait(() => select(cellId, "ack").some((frame) => frame.re === re), `${cellId} reply ack`);
};

try {
  send({
    source: readPythonSource(new URL("runner/", kernel)),
    launcher: readFileSync(new URL("process/launch-python.py", kernel), "utf8"),
    forkserverSource: buildForkserver(),
    configuration: { generation, maxActiveCells: 2, forkserverPreload: [], processWindow,
      options: { ...DEFAULT_KERNEL_RUNTIME_OPTIONS, chunkBytes: 24 }, scope: { enabled: false } },
  });
  await wait(() => select(null, "ready")[0], "real Python runner ready");
  await ended("init", command("init", "initialize", { source: await kernelPrelude({ moduleHome: home }) }));
  const a = execute("A", `import asyncio, socket, threading
shared_loop = asyncio.get_running_loop()
shared_thread = threading.current_thread()
a_task = asyncio.current_task()
shared_future = shared_loop.create_future()
shared_lock = asyncio.Lock()
await shared_lock.acquire()
lock_waiting = asyncio.Event()
left, right = socket.socketpair()
left.setblocking(False)
right.setblocking(False)
print('A waiting on future')
assert await shared_future == 42
lock_waiting.set()
await shared_lock.acquire()
shared_lock.release()
assert await shared_loop.sock_recv(left, 64) == b'before end'
print('A acquired lock')
answer_a = await gateway.call_async('ask', {'questions': [{'id': 'a', 'question': 'Release A?', 'options': [{'label': 'Yes'}]}]})
with open('trace-A', 'w'):
 pass
print('A ' + answer_a)
display('A display')`);
  await wait(() => output("A") === "A waiting on future\n", "A reached its pending Future");
  const b = execute("B", `b_task = asyncio.current_task()
assert asyncio.get_running_loop() is shared_loop and threading.current_thread() is shared_thread
assert shared_thread is not threading.main_thread() and b_task is not a_task
assert not a_task.done() and not shared_future.done()
shared_future.set_result(42)
await lock_waiting.wait()
# A sets the event immediately before suspending on the already-held lock.
assert shared_lock.locked() and not a_task.done()
shared_lock.release()
await shared_loop.sock_sendall(right, b'before end')
print('B released lock')
answer_b = await gateway.call_async('fixture_echo', {'from': 'B'})
with open('trace-B', 'w'):
 pass
print('B ' + answer_b)
display('B display')`);
  const overlap = await wait(() => select("B", "rejected")[0] ?? output("B").includes("B released lock\n"),
    "B must release the lock while A is active, before checking the callback interface");
  assert.equal(overlap, true, "The runner rejected B instead of scheduling it alongside A");
  assert.deepEqual(["A", "B"].map((id) => select(id, "cell_admitted")[0]?.mode), ["async", "async"]);
  await callback("A", { name: "ask", args: { questions: [{ id: "a", question: "Release A?", options: [{ label: "Yes" }] }] } });
  await callback("B", { name: "fixture_echo", args: { from: "B" } });
  assert.equal(select("A", "cell_end").length + select("B", "cell_end").length, 0);
  await reply("A", '{"ok":true,"value":', false);
  await reply("B", '{"ok":true,"value":', false);
  await reply("B", '"reply-B"}', true);
  await ended("B", b);
  assert.equal(select("A", "cell_end").length, 0);
  await reply("A", '"reply-A"}', true);
  await ended("A", a);
  assert.equal(output("A"), "A waiting on future\nA acquired lock\nA reply-A\n");
  assert.equal(output("B"), "B released lock\nB reply-B\n");
  for (const cellId of ["A", "B"]) {
    assert.equal(output(cellId, "result"), `'${cellId} display'`);
    const traces = select(cellId, "display").map(({ data }) => data["application/x-prk-trace+json"]).filter(Boolean);
    assert.deepEqual(traces.filter(({ args }) => /^'trace-[AB]'$/.test(args[0])).map(({ args }) => args[0]), [`'trace-${cellId}'`]);
  }

  await ended("private", execute("private", `private_loop = asyncio.get_running_loop()
assert private_loop is not shared_loop and threading.current_thread() is not shared_thread
await asyncio.sleep(0)`, "thread"));
  assert.equal(select("private", "cell_admitted")[0]?.mode, "thread");
  for (const [name, outcome] of [["SystemExit", "error"], ["KeyboardInterrupt", "aborted"]]) {
    await ended(name, execute(name, `raise ${name}()`, "async"), outcome);
    assert.equal(select(name, "error")[0]?.name, name);
  }
  await ended("C", execute("C", `assert asyncio.get_running_loop() is shared_loop and threading.current_thread() is shared_thread
assert a_task.done() and b_task.done() and private_loop.is_closed()
assert shared_future.get_loop() is shared_loop and await shared_future == 42
async with shared_lock:
 shared_loop.call_soon(right.send, b'after both')
 assert await shared_loop.sock_recv(left, 64) == b'after both'
left.close()
right.close()
print('C reused open sockets')
_idle = shared_loop.call_later(0.05, lambda: print('IDLE_LOOP', end=''))`));
  assert.equal(output("C"), "C reused open sockets\n");
  assert.deepEqual(await wait(() => frames.find(({ kind, text }) => kind === "diagnostic" && text.includes("IDLE_LOOP")),
    "idle loop runs without another execute"), { generation, kind: "diagnostic", stream: "stdout", text: "IDLE_LOOP" });

  const revoked = execute("revoked", `try:
 await gateway.call_async('fixture_echo', {'from': 'revoked'})
finally:
 print('revoked callback drained')`);
  await callback("revoked", { name: "fixture_echo", args: { from: "revoked" } });
  const cancel = command("revoked", "cancel");
  await wait(() => select("revoked", "ack").some(({ re }) => re === cancel), "callback revocation ack");
  await ended("revoked", revoked, "aborted");
  assert.equal(output("revoked"), "revoked callback drained\n");
  await reply("revoked", '{"ok":true}', true); // Discard but acknowledge a late reply.

  const d = execute("D", `shared_seed = [21]
try:
 print('D pending')
 await shared_loop.create_future()
finally:
 await asyncio.sleep(0)
 print('D drained')`);
  await wait(() => output("D") === "D pending\n", "live task before EOF");
  const isolated = command("isolated", "execute", { title: "isolated", mode: "isolated", defaultCellMode: "thread",
    inputs: ["shared_seed"], outputs: "isolated_value", code: `assert 'shared_loop' not in globals()
assert gateway.call('fixture_echo', {'from': 'isolated'}) == 'isolated reply'
return shared_seed + [21]` });
  await callback("isolated", { name: "fixture_echo", args: { from: "isolated" } });
  await reply("isolated", '{"ok":true,"value":"isolated reply"}', true);
  await ended("isolated", isolated);
  assert.equal(output("isolated", "result"), "Return (list): [21, 21]\n");
  assert.equal(select("D", "cell_end").length, 0);
  await ended("observe", execute("observe", `assert asyncio.get_running_loop() is shared_loop
assert shared_seed == [21] and isolated_value == [21, 21]`, "async"));
  child.stdin.end();
  await ended("D", d, "aborted");
  assert.deepEqual(await Promise.race([closed, setTimeout(2000, "EOF shutdown timed out", { ref: false })]), [0, null]);
  assert.equal(output("D"), "D pending\nD drained\n");
  assert(frames.indexOf(select("D", "stream").at(-1)) < frames.indexOf(select("D", "cell_end")[0]));
  assert.deepEqual(frames.filter(({ kind }) => kind === "cell_end").map(({ cellId }) => cellId),
    ["init", "B", "A", "private", "SystemExit", "KeyboardInterrupt", "C", "revoked", "isolated", "observe", "D"]);
} finally {
  child.stdin.end();
  if (!await Promise.race([closed.then(() => true), setTimeout(2000, false, { ref: false })])) {
    child.kill("SIGKILL");
    await closed;
  }
  await rm(home, { recursive: true, force: true });
}
