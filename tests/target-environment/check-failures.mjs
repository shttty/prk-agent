import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";

const fixture = await createOwnedEnvironment();
const events = [];
const logs = [];
let command;
const environments = createTargetEnvironments({
  resolve: () => ({ local: false, command }),
  onEvent: (id, event) => events.push({ id, ...event }),
  onLog: (id, text) => logs.push({ id, text }),
});
const selected = new Set(process.argv.slice(2));
const run = async (name, text, match) => {
  if (selected.size && !selected.has(name)) return;
  command = text;
  const from = events.length;
  const start = performance.now();
  await assert.rejects(environments.acquire(name), (error) => {
    assert.equal(error.code, "TARGET_UNREACHABLE");
    assert.match(error.cause.message, match);
    return true;
  });
  assert.ok(performance.now() - start < 14000, name);
  assert.equal(events.slice(from).some((event) => event.kind === "gate"), false);
  const count = events.length;
  await delay(150);
  assert.equal(events.length, count, `${name}: background retry`);
  console.log(JSON.stringify({ name, status: "PASS", elapsedMs: performance.now() - start, events: events.slice(from), logs: logs.filter((log) => log.id === name) }));
};
try {
  await run("bad-command", "printf 'owned failure\\n' >&2; exit 19", /code=19/);
  await run("missing-shell", "exec /prk-S1-no-such-shell", /code=127/);
  await run("stall", "exec /usr/bin/sleep 60", /detect: timeout/);
  for (const scenario of ["missing-tools", "bad-hash", "missing-token"]) {
    if (selected.size && !selected.has(scenario)) continue;
    const tools = join(fixture.root, scenario);
    await mkdir(tools);
    for (const tool of ["uname", "id", "base64", "sha256sum", "mkdir", "mv", "chmod", "rm"]) {
      if ((scenario === "missing-tools" && tool === "base64") || (scenario === "bad-hash" && tool === "sha256sum") || (scenario === "missing-token" && tool === "mv")) continue;
      await symlink(`/usr/bin/${tool}`, join(tools, tool));
    }
    if (scenario === "bad-hash") await writeFile(join(tools, "sha256sum"), "#!/bin/sh\nprintf '%064d  %s\\n' 0 \"$1\"\n", { mode: 0o755 });
    if (scenario === "missing-token") await writeFile(join(tools, "mv"), "#!/bin/sh\nprintf '#!/bin/sh\\nexec /usr/bin/sleep 60\\n' > \"$2\"\n/usr/bin/chmod 755 \"$2\"\n/usr/bin/rm -f \"$1\"\n", { mode: 0o755 });
    const text = `HOME=${quoteShell(join(tools, "home"))} PATH=${quoteShell(tools)} exec /bin/sh`;
    await run(scenario, text, scenario === "missing-tools" ? /missing tools/ : scenario === "bad-hash" ? /stdout EOF|exited|SHA-256/ : /exec-token: timeout/);
  }
} finally { await fixture.close(); }
