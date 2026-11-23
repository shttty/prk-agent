import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function checkAsynchronousHooks({ sessionId: worker, active, start, waitEvent, localEvents, remoteEvents, cancel, resultOf, events, normal, proof, root, releases, host }) {
    for (const location of ["local", "remote"]) {
      const token = randomUUID();
      const before = active(worker);
      const path = location === "local" ? localEvents : remoteEvents;
      const run = await start(worker, "hook_probe", { mode: `${location}-never`, token });
      await waitEvent(path, (entry) => entry.event === "call-enter" && entry.token === token, `${location} never-return hook entered`);
      const stopped = await cancel(worker, run);
      assert.equal(resultOf(worker, run).isError, true, "A cancelled tool_call hook must not execute the tool");
      assert(!(await events(remoteEvents)).some((entry) => entry.event === "execute" && entry.token === token));
      await waitEvent(path, (entry) => entry.event === "abort" && entry.token === token, `${location} hook signal aborted`);
      await normal(worker);
      assert.equal(active(worker), before, "An async hook acknowledges abort without killing the host");
      proof("never-return-hook-stop", { location, sessionId: worker, toolCallId: run.id, durationMs: stopped.durationMs, generation: before.generation, pid: before.registration.pid, nextRoundNormal: true });
    }
    for (const location of ["local", "remote"]) {
      const token = randomUUID();
      const path = location === "local" ? localEvents : remoteEvents;
      const release = join(root, `release-${token}`);
      releases.add(release);
      const run = await start(worker, "hook_probe", { mode: `${location}-result-late`, token });
      const entered = await waitEvent(path, (entry) => entry.event === "result-enter" && entry.token === token, `${location} tool_result hook entered`);
      assert.equal(entered.phase, "original");
      const stopped = await cancel(worker, run);
      const original = structuredClone(resultOf(worker, run));
      assert.equal(original.isError, false);
      assert.equal(original.details.phase, "original", "A failed tool_result handler must preserve the real tool result");
      assert.equal(original.details.token, token);
      await writeFile(release, "release\n");
      await waitEvent(path, (entry) => entry.event === "late-return" && entry.token === token, `${location} late hook returned`);
      await normal(worker); // A full later turn is the barrier for a late RPC reply, not a timing sleep.
      assert.deepEqual(resultOf(worker, run), original, "A late hook result must not replace the recorded original result");
      assert(!host.state(worker).messages.some((message) => message.role === "toolResult" && message.details?.phase === "late"));
      proof("tool-result-hook-stop", { location, sessionId: worker, toolCallId: run.id, durationMs: stopped.durationMs, retainedPhase: original.details.phase, lateResultDiscarded: true });
    }

}
