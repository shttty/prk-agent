import assert from "node:assert/strict";
import { fork, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const mode = process.argv[2];
assert.ok(["local", "office"].includes(mode));
const selected = new Set(process.argv.slice(3));
const run = (label) => !selected.size || selected.has(label);
assert.equal(process.env.JUPYTER_URL, undefined); assert.equal(process.env.JUPYTER_TOKEN, undefined);
const ssh = process.env.PI_TEST_SSH;
assert.ok(mode === "local" || ssh, "PI_TEST_SSH required for office");
const localRoot = await mkdtemp(join(tmpdir(), "prk-S3-D7-"));
const root = mode === "local" ? localRoot : `/tmp/prk-S3-${randomUUID()}`;
const python = mode === "local" ? process.env.PI_TEST_PYTHON : "/usr/bin/python3";
assert.ok(python);
const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;
function observe(script) {
  const result = spawnSync("/bin/sh", mode === "local" ? [] : ["-c", ssh], { input: script, encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
function readPids(pids) {
  return JSON.parse(observe(`${quote(python)} - <<'PY'\nimport json\nresult=[]\nfor pid in ${JSON.stringify(pids)}:\n try:\n  raw=open('/proc/%s/stat'%pid).read(); f=raw[raw.rfind(')')+2:].split(); result.append(dict(pid=pid,state=f[0],ppid=int(f[1]),pgid=int(f[2]),sid=int(f[3]),start=f[19]))\n except FileNotFoundError: result.append(dict(pid=pid,absent=True))\nprint(json.dumps(result))\nPY\n`));
}
const records = [];
let child;
let sequence = 0;
const pending = new Map();
function call(method, ...args) {
  const id = ++sequence;
  const result = Promise.withResolvers(); pending.set(id, result);
  child.send({ id, method, args }); return result.promise;
}
async function start() {
  const ready = Promise.withResolvers();
  child = fork(new URL("../fixtures/pty-browser/d7-worker.mjs", import.meta.url), [], {
    env: { ...process.env, HOME: localRoot, PRK_HOME: join(localRoot, "prk"), PRK_SOCKET: join(localRoot, "g.sock"), S3_D7_CONFIG: JSON.stringify({ root, localRoot, python, command: mode === "office" ? `${ssh} ${quote(`HOME=${quote(root)} exec /bin/bash`)}` : undefined }) },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  child.on("message", (message) => {
    if (message.ready) ready.resolve(message);
    else if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request.reject(new Error(message.error)); else request.resolve(message.result); }
    else console.log(JSON.stringify({ mode, fixture: message }));
  });
  child.on("exit", (code, signal) => { const error = new Error(`Gateway fixture exited ${code}/${signal}`); ready.reject(error); for (const value of pending.values()) value.reject(error); pending.clear(); });
  console.log(JSON.stringify({ mode, gateway: await ready.promise, pid: child.pid }));
}
async function open(name, owner) {
  const value = await call("open", name, owner);
  const identities = readPids(value.pids);
  assert.ok(identities.every((entry) => !entry.absent));
  assert.equal(identities[0].pgid, identities[0].pid);
  assert.equal(identities[1].pgid, identities[1].pid);
  assert.equal(identities[0].ppid, identities[1].pid);
  assert.notEqual(identities[2].pgid, identities[0].pgid);
  records.push(...identities);
  console.log(JSON.stringify({ mode, opened: value, identities }));
  return identities;
}
function verify(identities, label) {
  const expected = JSON.stringify(identities);
  const result = observe(`${quote(python)} - <<'PY'\nimport json,time\nexpected=${expected}\ndef read(pid):\n try:\n  raw=open('/proc/%s/stat'%pid).read(); f=raw[raw.rfind(')')+2:].split(); return dict(pid=pid,state=f[0],ppid=int(f[1]),pgid=int(f[2]),sid=int(f[3]),start=f[19])\n except FileNotFoundError: return dict(pid=pid,absent=True)\nfor attempt in range(200):\n rows=[read(e['pid']) for e in expected]\n if all(r.get('absent') or r.get('start')!=e['start'] for r,e in zip(rows[:3],expected[:3])): break\n time.sleep(.05)\nprint(json.dumps(rows))\nassert all(r.get('absent') or r.get('start')!=e['start'] for r,e in zip(rows[:3],expected[:3])), 'ordinary processes survived'\nassert all(not r.get('absent') and r.get('start')==e['start'] and r.get('state')!='Z' for r,e in zip(rows[3:],expected[3:])), 'explicit detached process was killed'\nPY\n`);
  console.log(JSON.stringify({ mode, label, observed: JSON.parse(result), status: "PASS" }));
}
await mkdir(join(localRoot, "prk"));
observe(`mkdir -p ${quote(root)}; printf '%s\n' 'export S3_LOGIN=owned' > ${quote(`${root}/.bash_profile`)}\n`);
try {
  await start();
  for (const owner of ["human", "model"]) {
    if (run(`natural-${owner}`)) {
      const ids = await open(`natural-${owner}`, owner);
      await call("exit", `natural-${owner}`); verify(ids, `natural-exit-${owner}`);
    }
    if (run("exit-status")) console.log(JSON.stringify({ mode, naturalStatus: await call("naturalStatus", owner) }));
  }
  if (run("normal-close")) {
    const normal = await open("normal"); assert.deepEqual(await call("close", "normal"), { closed: true }); verify(normal, "normal-close");
  }
  if (run("closeSession")) {
    const sessionA = await open("session-a"), sessionB = await open("session-b", "model");
    assert.deepEqual(await call("closeSession"), { terminals: [] }); verify(sessionA, "close-session-human"); verify(sessionB, "close-session-model");
  }
  if (run("model")) console.log(JSON.stringify({ mode, model: await call("model"), status: "PASS" }));
  if (run("disconnect")) {
    const disconnect = await open("disconnect"); await call("disconnect"); verify(disconnect, "transport-wrapper-SIGKILL");
  }
  if (run("shutdown")) {
    const shutdown = await open("shutdown"); assert.deepEqual(await call("shutdown"), { terminals: [] }); verify(shutdown, "graceful-shutdown");
  }
  await call("stop"); await once(child, "exit");
  if (run("gateway")) {
    await start();
    const gateway = await open("gateway");
    const exited = once(child, "exit"); child.kill("SIGKILL"); await exited; verify(gateway, "Gateway-SIGKILL");
  }
  console.log(JSON.stringify({ mode, status: "PASS", selected: [...selected] }));
} finally {
  if (child?.connected) { try { await call("stop"); } catch {} }
  const cleanup = observe(`${quote(python)} - <<'PY'\nimport json,os,signal,time\nrecords=${JSON.stringify(records)}\nfor item in records:\n try:\n  raw=open('/proc/%s/stat'%item['pid']).read(); f=raw[raw.rfind(')')+2:].split()\n  if f[19]==item['start']: os.kill(item['pid'], signal.SIGKILL)\n except ProcessLookupError: pass\n except FileNotFoundError: pass\nprint(json.dumps(dict(cleanup='recorded owned PIDs signalled only',count=len(records))))\nPY\nrm -rf ${quote(root)}\n`);
  console.log(cleanup.trim());
  await rm(localRoot, { recursive: true, force: true });
}
