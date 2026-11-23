import assert from "node:assert/strict";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DEFAULT_TERMINAL_OPTIONS } from "../../../src/config/terminal/terminal-options.ts";
import { createPythonTool } from "../../../src/kernel/assemble-kernel.ts";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { parseProcessWindowLimits } from "../../../src/target-environment/process-window/parse-limits.ts";

const releaseMarker = ".lifecycle-release-C";
// Only the runner payload is controlled. pi-env still owns the actual process, pipes and process group.
const runner = String.raw`
import json, os, platform, sys, time

generation = json.loads(sys.stdin.buffer.readline())["configuration"]["generation"]
identity = dict(pid=os.getpid(), pgid=os.getpgrp())

def emit(kind, cellId, **fields):
    print(json.dumps(dict(generation=generation, kind=kind, cellId=cellId, **fields)), flush=True)

emit("ready", None, **identity, scoped=False, language="python", version=platform.python_version())
for line in sys.stdin:
    frame = json.loads(line)
    assert frame["generation"] == generation
    cell, request, kind = frame["cellId"], frame["id"], frame["kind"]
    if kind == "initialize":
        emit("cell_end", cell, re=request, outcome="ok")
    elif kind == "execute":
        title = frame["title"]
        assert title in ("A", "B", "C"), title
        if title == "A":
            emit("stream", cell, stream="stdout", text=json.dumps(identity) + "\n")
        emit("cell_admitted", cell, re=request, mode="thread")
        if title == "C":
            while not os.path.isfile(${JSON.stringify(releaseMarker)}):
                time.sleep(0.01)
            emit("stream", cell, stream="stdout", text="C-original\n")
            emit("cell_end", cell, re=request, outcome="ok")
    else:
        raise AssertionError(kind)
`;

export function createRetirementOwner(target) {
  const observed = { acquisitions: 0, starts: [], releases: [], execs: [] };
  const loss = new AbortController();
  const fixtureCleanup = new AbortController();
  const processEnds = [];
  const finished = [];
  let freezeProbe;
  const owner = createPythonTool({
    target: "owned", python: target.python, cwd: target.root, scoped: false, memoryMax: "4G", memorySwapMax: "0",
    processWindow: parseProcessWindowLimits(),
    async acquire() {
      const lease = await target.acquire();
      observed.acquisitions++;
      return {
        ...lease,
        // Lose only the owner's view of the lease, not the real daemon or its process handle.
        signal: AbortSignal.any([lease.signal, loss.signal]),
        connection: {
          info: (signal) => lease.connection.info(signal),
          async request(op, params, options) {
            if (op === "process") {
              const [python, unbuffered, command, , ...rest] = params.argv;
              const ended = lease.connection.request(op, { ...params, argv: [python, unbuffered, command, runner, ...rest] }, {
                ...options,
                signal: AbortSignal.any([options.signal, fixtureCleanup.signal]),
                onEvent(event, payload) {
                  if (event.kind === "started") observed.starts.push(Number(event.pid));
                  options.onEvent(event, payload);
                },
              });
              processEnds.push(ended.catch(() => {}));
              return ended;
            }
            if (op !== "exec") return lease.connection.request(op, params, options);
            const observation = { argv: params.argv.map((arg) => arg.includes("\n") ? "<probe source>" : arg) };
            observed.execs.push(observation);
            try {
              const reply = await lease.connection.request(op, params, options);
              observation.exitCode = reply.json.exitCode;
              return reply;
            } catch (error) {
              observation.error = String(error);
              throw error;
            }
          },
        },
        async release() {
          observed.releases.push(finished.map(({ toolCallId }) => toolCallId));
          await lease.release();
        },
      };
    },
  }, {
    codeMode: true, runnerMaxActiveCells: 4, prelude: async () => "pass",
    outputOptions: {
      ...DEFAULT_TERMINAL_OPTIONS,
      // Same reentry seam as check-active-cell-admission: final formatting before result publication.
      get outputBytes() {
        const probe = freezeProbe;
        freezeProbe = undefined;
        probe?.();
        return DEFAULT_TERMINAL_OPTIONS.outputBytes;
      },
    },
  });
  const unsubscribe = owner.subscribeFinished((cell) => finished.push(cell));
  return {
    owner, finished, observed,
    async startCell(title) {
      const running = await owner.tool.execute(title, { code: "pass", title, yield_s: 0 });
      const { cell_id: cellId } = JSON.parse(running.content[0].text);
      assert.equal(typeof cellId, "string", "the runner cell must yield an addressable handle");
      const deadline = performance.now() + 5000;
      for (;;) {
        const preview = owner.previewCell(cellId);
        if (preview?.mode === "thread") return preview;
        if (performance.now() >= deadline) assert.fail(`${title} not admitted by the owned runner`);
        await delay(10);
      }
    },
    ownedIdentity(cell) {
      const identity = JSON.parse(cell.output);
      assert.deepEqual(observed.starts, [identity.pid], "runner PID must match the owned pi-env process start");
      assert(Number.isSafeInteger(identity.pid) && identity.pid > 1 && identity.pgid === identity.pid, JSON.stringify(identity));
      return identity;
    },
    async finishC(probe) {
      freezeProbe = probe;
      await target.observe(`: > ${quoteShell(join(target.root, releaseMarker))}\n`);
    },
    loseLease() { loss.abort(new Error("Injected owner lease loss")); },
    async dispose() {
      freezeProbe = undefined;
      unsubscribe();
      for (const cell of finished) cell.release();
      fixtureCleanup.abort();
      await Promise.all([owner.close().catch(() => {}), ...processEnds]);
    },
  };
}

export async function probeOwnedGroup(target, { pid, pgid }) {
  assert(Number.isSafeInteger(pid) && pid > 1 && Number.isSafeInteger(pgid) && pgid > 1);
  return JSON.parse(await target.observe(`${quoteShell(target.python)} - <<'PY'
import json, os
try:
    pid_pgid = os.getpgid(${pid})
except ProcessLookupError:
    pid_pgid = None
try:
    os.killpg(${pgid}, 0)
    group_exists = True
except ProcessLookupError:
    group_exists = False
print(json.dumps(dict(pidPgid=pid_pgid, groupExists=group_exists)))
PY
`));
}
