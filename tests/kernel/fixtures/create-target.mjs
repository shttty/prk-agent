import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createTargetEnvironments } from "../../../src/target-environment/connection/assemble-environments.ts";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { runOwnedShell } from "../../fixtures/target-environment/run-owned-shell.mjs";

export async function createTarget(mode) {
  if (mode === "office" && !process.env.PI_TEST_SSH) throw new Error("PI_TEST_SSH required for office");
  const home = await mkdtemp(join(tmpdir(), "prk-S4-"));
  const root = mode === "office" ? `/tmp/prk-S4-${randomUUID()}` : home;
  const command = mode === "office" ? process.env.PI_TEST_SSH : "exec /bin/sh";
  await runOwnedShell(command, `mkdir -p ${quoteShell(root)}\n`);
  process.env.HOME = home;
  process.env.PRK_HOME = join(home, "prk");
  delete process.env.JUPYTER_URL;
  delete process.env.JUPYTER_TOKEN;
  const sshCommand = mode === "office" ? `${command} ${quoteShell(`HOME=${quoteShell(root)} exec /bin/bash`)}` : undefined;
  const environments = createTargetEnvironments({
    resolve: () => mode === "office" ? { local: false, command: sshCommand } : { local: true },
    onEvent: (id, event) => console.log(JSON.stringify({ id, ...event })),
  });
  const leases = [];
  return {
    home, root, local: mode !== "office", sshCommand, python: mode === "office" ? "/usr/bin/python3" : process.env.PI_TEST_PYTHON,
    acquire: async () => { const lease = await environments.acquire(mode); leases.push(lease); return lease; },
    observe: (script) => runOwnedShell(command, script),
    async close() {
      await Promise.all(leases.map((lease) => lease.release()));
      if (mode === "office") await runOwnedShell(command, `rm -rf ${quoteShell(root)}\n`);
      await rm(home, { recursive: true, force: true });
    },
  };
}
