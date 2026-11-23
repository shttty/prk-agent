import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createTargetEnvironments } from "../../../src/target-environment/connection/assemble-environments.ts";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";
import { runOwnedShell } from "../../fixtures/target-environment/run-owned-shell.mjs";

export async function createEnvironment(mode) {
  if (!["local", "office"].includes(mode)) throw new Error("Choose local or office.");
  if (process.env.JUPYTER_URL !== undefined || process.env.JUPYTER_TOKEN !== undefined) throw new Error("Unset Jupyter credentials.");
  if (!process.env.HOME || !process.env.PRK_HOME || !process.env.PI_TEST_PYTHON || !process.env.TMPDIR) throw new Error("Explicit owned HOME/PRK_HOME/TMPDIR/PI_TEST_PYTHON required.");
  if (mode === "office" && !process.env.PI_TEST_SSH) throw new Error("PI_TEST_SSH required for office.");
  const localRoot = await mkdtemp(join(process.env.TMPDIR, "prk-S2-"));
  const root = mode === "office" ? `/tmp/prk-S2-${randomUUID()}` : localRoot;
  const ssh = process.env.PI_TEST_SSH;
  const observer = mode === "office" ? ssh : "exec /bin/sh";
  const observe = (script) => runOwnedShell(observer, script);
  await observe(`mkdir -p ${quoteShell(root)}\n`);
  await mkdir(join(localRoot, "prk"));
  const events = [];
  const environments = createTargetEnvironments({
    resolve: () => mode === "local" ? { local: true } : {
      local: false, command: `${ssh} ${quoteShell(`HOME=${quoteShell(root)} exec /bin/bash --noprofile --norc`)}`,
    },
    onEvent: (id, event) => events.push({ id, ...event }),
    onLog: (id, text) => console.log(JSON.stringify({ id, text })),
  });
  const sentinel = await environments.acquire("owned");
  console.log(JSON.stringify({ mode, root, hello: sentinel.info, generation: sentinel.generation }));
  return {
    mode, root, localRoot, observe, environments, sentinel, events,
    async close() {
      await sentinel.release();
      const remaining = await observe(`ps -o pid=,stat= -p ${sentinel.info.pid}\ntrue\n`);
      console.log(JSON.stringify({ ownedDaemon: sentinel.info.pid, afterRelease: remaining }));
      if (remaining.trim()) throw new Error(`Owned daemon did not exit: ${remaining}`);
      if (mode === "office") await observe(`rm -rf -- ${quoteShell(root)}\n`);
      await rm(localRoot, { recursive: true, force: true });
    },
  };
}
