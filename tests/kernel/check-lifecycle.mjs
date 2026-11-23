import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Type } from "typebox";
import { createTarget } from "./fixtures/create-target.mjs";
import { createSession } from "./fixtures/create-session.mjs";
import { createRetirementOwner, probeOwnedGroup } from "./fixtures/create-retirement-owner.mjs";

const present = ({ pgid }) => ({ pidPgid: pgid, groupExists: true });
const absent = { pidPgid: null, groupExists: false };

async function checkCommandedRetirement(target, sentinel, sentinelBefore) {
  const fixture = createRetirementOwner(target);
  const { owner, finished, observed } = fixture;
  try {
    const a = await fixture.startCell("A");
    const b = await fixture.startCell("B");
    const c = await fixture.startCell("C");
    const identity = fixture.ownedIdentity(a);
    assert.notEqual(identity.pgid, sentinelBefore.pgid);
    assert.equal(new Set([a.cellId, b.cellId, c.cellId]).size, 3);
    assert.equal(new Set([a.kernelId, b.kernelId, c.kernelId]).size, 1);
    const before = await probeOwnedGroup(target, identity);
    assert.deepEqual(before, present(identity));

    let cut;
    const closing = Promise.withResolvers();
    void closing.promise.catch(() => {});
    await fixture.finishC(() => {
      cut = {
        statuses: [a, b, c].map(({ cellId }) => owner.previewCell(cellId)?.status),
        finished: finished.map(({ toolCallId }) => toolCallId),
      };
      const first = owner.close();
      const duplicate = owner.close();
      cut.sameClose = first === duplicate;
      Promise.all([first, duplicate]).then(closing.resolve, closing.reject);
    });
    await Promise.race([closing.promise, delay(8000, undefined, { ref: false }).then(() => {
      assert.fail("Retirement from C's final formatting timed out");
    })]);
    assert.deepEqual(cut, { statuses: ["running", "running", "freezing"], finished: [], sameClose: true });
    const after = await probeOwnedGroup(target, identity);
    assert.deepEqual(after, absent, "close must remove the real owned process group");

    assert.deepEqual(finished.map(({ toolCallId }) => toolCallId).toSorted(), ["A", "B", "C"]);
    const expected = [
      { kernelId: a.kernelId, cellId: a.cellId, taskName: "A" },
      { kernelId: b.kernelId, cellId: b.cellId, taskName: "B" },
    ];
    const retired = [];
    for (const cell of [a, b]) {
      const event = finished.find(({ cellId }) => cellId === cell.cellId);
      const result = await owner.readCell(cell.cellId);
      assert.deepEqual(event.result, result);
      const { outcome, reason, cause, affectedCells } = result.details;
      assert.equal(outcome, "aborted");
      assert.equal(reason, "kernel 重启");
      assert.equal(cause, "close");
      assert.deepEqual(affectedCells.toSorted((x, y) => x.taskName.localeCompare(y.taskName)), expected);
      assert.equal(event.reason, reason);
      assert.equal(event.cause, cause);
      assert.deepEqual(event.affectedCells, affectedCells);
      retired.push({ cellId: cell.cellId, outcome, reason, cause, affectedCells });
    }
    assert.deepEqual(retired[0].affectedCells, retired[1].affectedCells);
    const original = await owner.readCell(c.cellId);
    assert.deepEqual(original, finished.find(({ cellId }) => cellId === c.cellId).result);
    assert.equal(original.details.outcome, "ok");
    assert.equal(Boolean(original.isError), false);
    assert.equal(original.details.reason, undefined);
    assert.equal(original.details.affectedCells, undefined);
    assert.equal(original.details.cause, undefined);
    assert.deepEqual(original.content, [{ type: "text", text: "C-original\n" }]);
    assert.equal(observed.acquisitions, 1);
    assert.equal(observed.releases.length, 1, "duplicate closes must release the owned lease once");
    assert.deepEqual(observed.releases[0].toSorted(), ["A", "B", "C"], "terminal results precede lease release");
    const sentinelAfter = await readSentinel(sentinel);
    assert.deepEqual(sentinelAfter, sentinelBefore);
    return { identity, before, after, cut, retired, original: { cellId: c.cellId, ...original }, observed, sentinelAfter };
  } finally { await fixture.dispose(); }
}

async function checkLostLease(target) {
  const fixture = createRetirementOwner(target);
  const { owner, observed } = fixture;
  try {
    const a = await fixture.startCell("A");
    const b = await fixture.startCell("B");
    assert.equal(b.kernelId, a.kernelId);
    assert.deepEqual([a.status, b.status], ["running", "running"]);
    const identity = fixture.ownedIdentity(a);
    const before = await probeOwnedGroup(target, identity);
    assert.deepEqual(before, present(identity));
    fixture.loseLease();
    const readBoth = () => Promise.all([a, b].map(({ cellId }) => owner.readCell(cellId)));
    const unknown = await readBoth();
    for (const reply of unknown) {
      assert.equal(reply.details.outcome, "unknown");
      assert.equal(reply.details.affectedCells, undefined);
    }
    const afterLoss = await probeOwnedGroup(target, identity);
    assert.deepEqual(afterLoss, present(identity), "lease loss must not be mistaken for process exit");
    assert.deepEqual(observed.execs, [], "loss did not run a target cleanup operation");

    let failure;
    await assert.rejects(owner.restart(), (error) => {
      failure = { code: error.code, message: error.message, details: error.details };
      assert.equal(error.code, "UNAVAILABLE");
      assert.equal(error.details.closed, true);
      assert.equal(error.details.cleanup, "unconfirmed");
      assert.equal(error.details.kernelId, a.kernelId);
      assert.equal(error.details.pgid, identity.pgid);
      return true;
    });
    assert.equal(observed.acquisitions, 1, "unconfirmed cleanup must not acquire a replacement lease");
    assert.deepEqual(observed.starts, [identity.pid], "unconfirmed cleanup must not start a new generation");
    assert.equal(observed.releases.length, 1);
    assert.deepEqual(await readBoth(), unknown, "failed cleanup must not rewrite unknown results");
    const afterRestart = await probeOwnedGroup(target, identity);
    const outcomes = [a, b].map(({ cellId }, i) => ({ cellId, outcome: unknown[i].details.outcome }));
    return { identity, before, afterLoss, afterRestart, outcomes, failure, observed };
  } finally { await fixture.dispose(); }
}

async function readSentinel(sentinel) {
  const report = await sentinel.run("import os,json\nprint('SENTINEL='+json.dumps(dict(pid=os.getpid(),pgid=os.getpgrp(),value=sentinel_value)))");
  assert.equal(Boolean(report.result.isError), false, report.text);
  return JSON.parse(/SENTINEL=(\{[^\n]+\})/.exec(report.text)[1]);
}

const target = await createTarget(process.argv[2] ?? "local");
let first, sentinel, ask;
const callbackStarted = Promise.withResolvers();
try {
  first = await createSession(target);
  sentinel = await createSession(target);
  const initial = await first.run("import os,json\nx=41\nprint('IDENTITY='+json.dumps({'pid':os.getpid(),'pgid':os.getpgrp(),'cwd':os.getcwd()}))");
  assert.equal(Boolean(initial.result.isError), false, initial.text);
  const identity = JSON.parse(/IDENTITY=(\{[^\n]+\})/.exec(initial.text)[1]);
  assert.equal(identity.cwd, target.root);
  await sentinel.run("sentinel_value=99");
  const observingLease = await target.acquire();
  await observingLease.connection.request("exec", { argv: ["/bin/kill", "-INT", "--", `-${identity.pgid}`], cwd: target.root });
  assert.match((await first.run("x")).text, /41/);
  const busy = Promise.withResolvers();
  const unsubscribe = first.owner.subscribe((snapshot) => { if (snapshot.state === "busy") busy.resolve(); });
  const running = first.run("while True: pass");
  await busy.promise;
  await delay(40);
  await first.session.abort();
  await running;
  unsubscribe();
  const retained = await first.run("print(os.getpid(),x)");
  assert(retained.text.includes(String(identity.pid)) && retained.text.includes("41"), retained.text);
  const tools = [
    { name: "ask", label: "ask", description: "Owned user wait.", exposure: "codemode", parameters: Type.Object({}), execute: async () => {
      await delay(450); return { content: [{ type: "text", text: "answered" }], structuredContent: 42 };
    } },
    { name: "slow", label: "slow", description: "Owned cancellable callback.", exposure: "codemode", parameters: Type.Object({}), execute: async () => {
      callbackStarted.resolve(); await delay(450); return { content: [{ type: "text", text: "LATE_REPLY" }], structuredContent: 777 };
    } },
  ];
  ask = await createSession(target, { tools, options: { executionTimeoutMs: 200 } });
  const waited = await ask.run("assert gateway.ask() == 42\nanswer=41");
  assert.equal(Boolean(waited.result.isError), false, waited.text);
  const waiting = ask.run("late=gateway.slow()");
  await callbackStarted.promise;
  await ask.session.abort();
  await waiting;
  assert.match((await ask.run("print(answer, 'late' in globals())")).text, /41 False/);
  await delay(500);
  assert.match((await ask.run("print(answer, 'late' in globals())")).text, /41 False/);
  const dead = Promise.withResolvers();
  const off = first.owner.subscribe((snapshot) => { if (snapshot.state === "busy") dead.resolve(); });
  const unknown = first.run("open('once.txt','a').write('once\\n')\nwhile True: pass");
  await dead.promise;
  for (let i = 0; i < 50; i++) {
    const observed = await target.observe(`test -f '${target.root}/once.txt' && cat '${target.root}/once.txt' || true\n`);
    if (observed.includes("once")) break;
    if (i === 49) assert.fail("side effect not observed before kill");
    await delay(20);
  }
  await observingLease.connection.request("exec", { argv: ["/bin/kill", "-KILL", String(identity.pid)], cwd: target.root });
  const lost = await unknown;
  off();
  assert.equal(lost.result.details.outcome, "unknown", lost.text);
  const fresh = await first.run("print('x' in globals())\nprint(open('once.txt').read())");
  assert.match(fresh.text, /False/);
  assert.equal((fresh.text.match(/once/g) ?? []).length, 1, fresh.text);
  assert.match((await sentinel.run("sentinel_value")).text, /99/);
  await first.close(); first = undefined;
  assert.match((await sentinel.run("sentinel_value")).text, /99/);
  const observed = await target.observe(`ps -o pid=,pgid=,stat= -p ${identity.pid}\ntrue\n`);
  assert.equal(observed.trim(), "", observed);
  const sentinelBefore = await readSentinel(sentinel);
  assert.equal(sentinelBefore.value, 99);
  const commanded = await checkCommandedRetirement(target, sentinel, sentinelBefore);
  console.log(JSON.stringify({ evidence: "s07-commanded-retirement", ...commanded, sentinelBefore }));
  const lostLease = await checkLostLease(target);
  const sentinelAfterLoss = await readSentinel(sentinel);
  assert.deepEqual(sentinelAfterLoss, sentinelBefore);
  console.log(JSON.stringify({ evidence: "s07-lost-lease", ...lostLease, sentinelBefore, sentinelAfterLoss }));
  console.log(JSON.stringify({ status: "PASS", mode: process.argv[2] ?? "local", root: target.root, identity, oldProcessAbsent: true, sentinelPreserved: true }));
} finally {
  await first?.close(); await ask?.close(); await sentinel?.close(); await target.close();
}
