import assert from "node:assert/strict";
import { cli } from "./run-cli.mjs";
import { until } from "./wait-condition.mjs";
import { bounded } from "./wait-bounded.mjs";
import { assertProcessExited } from "../../fixtures/target-environment/assert-process-exited.mjs";

export async function checkCliShutdown({ interactive, signal, b, worker, initial, cancelled, entry, root, socket, env, gateway, exists, sentinel, ownedPid }) {
  await until(() => interactive.stdout.includes('"snapshot"'), "interactive CLI snapshot", signal);
  interactive.child.stdin.end("/state\n/workbench\n/quit\n");
  assert.equal(await bounded(interactive.done, "interactive CLI exit"), 0);
  assert.equal((await b.request("state", { sessionId: worker })).sessionId, initial.sessionId);
  console.log(`PASS: real CLI second model request retained variable/file=42; same worker/kernel; explicit cancel terminal=${cancelled.status}, observed reuse and no cancellation-tail file`);
  const shutdown = JSON.parse(await cli(entry, root, ["attach", "--socket", socket, "shutdown"], env));
  assert.equal(shutdown.closed, true); // Host closure acknowledgement, not endpoint cleanup proof.
  assert.equal(await bounded(gateway.done, "gateway native listener shutdown"), 0);
  assert.equal(await exists(socket), false);
  await assertProcessExited(ownedPid);
  const check = await sentinel.tool.execute("sentinel-after-shutdown", { code: "assert sentinel_value == 73" });
  assert.equal(check.isError, undefined, JSON.stringify(check.content));
  console.log("PASS explicit shutdown: owned REPL exit and socket removal; independent sentinel remains executable");
}
