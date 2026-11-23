import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createTargetEnvironments } from "../../../src/target-environment/connection/assemble-environments.ts";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { runOwnedShell } from "./run-owned-shell.mjs";

export async function createOwnedEnvironment({ remoteCommand, prefix = "prk-S1-" } = {}) {
  const localRoot = await mkdtemp(join(tmpdir(), prefix));
  const root = remoteCommand ? `/tmp/${prefix}${randomUUID()}` : localRoot;
  const observer = remoteCommand ?? "exec /bin/sh";
  await runOwnedShell(observer, `mkdir -p ${quoteShell(root)}\n`);
  const previousHome = process.env.HOME;
  const previousPrk = process.env.PRK_HOME;
  process.env.HOME = localRoot;
  process.env.PRK_HOME = join(localRoot, "prk");
  const events = [];
  const logs = [];
  const leases = [];
  const command = remoteCommand
    ? `${remoteCommand} ${quoteShell(`HOME=${quoteShell(root)} exec /bin/bash`)}`
    : `S1_AUTH=owned HOME=${quoteShell(root)} exec /bin/sh`;
  const environments = createTargetEnvironments({
    resolve: (id) => id === "local" ? { local: true } : {
      local: false,
      command,
    },
    onEvent: (id, event) => events.push({ id, ...event }),
    onLog: (id, text) => logs.push({ id, text }),
  });
  return {
    root, localRoot, command, events, logs, environments,
    acquire: async (id) => {
      const lease = await environments.acquire(id);
      leases.push(lease);
      return lease;
    },
    observe: (script) => runOwnedShell(observer, script),
    close: async () => {
      try { await Promise.all(leases.map((lease) => lease.release())); }
      finally {
        if (previousHome === undefined) delete process.env.HOME; else process.env.HOME = previousHome;
        if (previousPrk === undefined) delete process.env.PRK_HOME; else process.env.PRK_HOME = previousPrk;
        if (remoteCommand) await runOwnedShell(observer, `rm -rf ${quoteShell(root)}\n`);
        await rm(localRoot, { recursive: true, force: true });
      }
    },
  };
}
