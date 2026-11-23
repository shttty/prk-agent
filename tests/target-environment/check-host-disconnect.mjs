import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";
import { createTargetChannels } from "../../src/target-channel/channels/assemble-channels.ts";
import { openProcessTransport } from "../../src/target-channel/process-transport/open.ts";
import { quoteShell as q } from "../../src/target-environment/daemon/quote-shell.mjs";

const mode = process.argv[2] ?? "local";
const unscoped = process.argv[3] === "unscoped";
assert.equal(mode, "local", "This focused probe currently uses local owned source and runtime");
assert(process.env.PI_TEST_PYTHON);
assert(!process.env.JUPYTER_URL && !process.env.JUPYTER_TOKEN);
const fixture = await createOwnedEnvironment({ prefix: "prk-S5-" });
let environment;
const channels = createTargetChannels({
  options: { startTimeoutMs: 10000 },
  open: async (_, signal) => {
    environment = await fixture.acquire("local");
    return { transport: await openProcessTransport(environment, process.env.PI_TEST_PYTHON, fixture.root, signal), command: "" };
  },
});
const lease = channels.acquire("local");
const record = `${fixture.root}/identity.json`;
const host = `${fixture.root}/host.mjs`;
const source = `import ${JSON.stringify(pathToFileURL(resolve("src/remote-extensions/host/start-host.mjs")).href)};
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const ordinary=spawn('sleep',['300'],{stdio:'ignore'});
const escaped=process.env.PRK_EXT_SCOPE_PATH ? spawn('sleep',['300'],{stdio:'ignore',detached:true}) : undefined;
writeFileSync(${JSON.stringify(record)},JSON.stringify({host:process.pid,ordinary:ordinary.pid,escaped:escaped?.pid,scope:process.env.PRK_EXT_SCOPE_PATH??null}));
`;
let identity;
try {
  await fixture.observe(`printf %s ${q(source)} > ${q(host)}\n`);
  const started = await lease.request("remoteExtensions", "start", {
    generation: randomUUID(), runtime: process.execPath, runtimeArgs: [], host, cwd: fixture.root,
    env: unscoped ? { PRK_FORCE_UNSCOPED: "1" } : {},
    memoryMax: 1073741824, memorySwapMax: 0,
  });
  for (let i = 0; i < 100; i++) {
    const text = await fixture.observe(`test ! -f ${q(record)} || cat ${q(record)}\n`);
    if (text) { identity = JSON.parse(text); break; }
    await delay(20);
  }
  assert(identity, "Host must create owned children before disconnect");
  console.log(JSON.stringify({ phase: "started", mode, started, identity, daemon: environment.info.pid, root: fixture.root }));
  const event = fixture.events.find((entry) => entry.kind === "spawn");
  assert(event?.wrapperPid);
  process.kill(event.wrapperPid, "SIGKILL");
  await delay(2000);
  const pids = [environment.info.pid, identity.host, identity.ordinary, identity.escaped].filter(Boolean);
  const observed = await fixture.observe(`ps -o pid=,ppid=,pgid=,stat=,args= -p ${pids.join(",")}\ntrue\n`);
  console.log(JSON.stringify({ phase: "after-disconnect", identity, observed, retired: environment.signal.aborted }));
  assert.equal(observed.trim(), "", "Owned host scope/process-group descendants must exit after transport loss");
} finally {
  if (identity) {
    const pids = [identity.host, identity.ordinary, identity.escaped].filter(Boolean);
    await fixture.observe(`kill -KILL ${pids.join(" ")} 2>/dev/null || true\n`);
  }
  await lease.release().catch((error) => console.error(error));
  await fixture.close().catch((error) => console.error(error));
}
