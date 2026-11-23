import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export async function destroyChild({ idle, parent, ns, call, until, gone, fixture, host, sleep, ms }, row) {
        await idle(parent);
        const started = ns();
        await call("session_manage", { action: "destroy", child: row.child });
        const pids = [row.kernel?.pid, row.host?.pid].filter(Boolean);
        await until(async () => (await Promise.all(pids.map(gone))).every(Boolean), "owned processes exit");
        if (row.kernel) {
          assert(row.kernelId, "Executed REPL must have an observed execution identity");
          const procs = await readFile(join("/sys/fs/cgroup", row.kernel.scope, "cgroup.procs"), "utf8").catch((error) => {
            if (error.code === "ENOENT") return "";
            throw error;
          });
          assert.equal(procs.trim(), "", "Destroyed kernel scope must be gone or empty");
        }
        assert(!host.workbench().sessions.some((session) => session.sessionId === row.child));
        row.cleanup = { pids, allExited: true };
        row.metrics.destroyMs = ms(started);
        await sleep(100);
        row.afterRss = process.memoryUsage.rss();
        row.metrics.gatewayAfterDeltaBytes = row.afterRss - row.beforeRss;
        row.metrics.gatewayDropBytes = row.liveRss - row.afterRss;
      }
