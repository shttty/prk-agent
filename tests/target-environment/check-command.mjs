import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openProcess } from "@earendil-works/pi-env";
import { createTargetEnvironments } from "../../src/target-environment/connection/assemble-environments.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";
import { createOwnedEnvironment } from "../fixtures/target-environment/create-owned-environment.mjs";

const fixture = await createOwnedEnvironment();
let lease;
try {
  const auth = join(fixture.root, "fake-auth");
  await writeFile(auth, "#!/bin/sh\n[ \"$SSHPASS\" = owned-test ] || exit 24\nexec /bin/sh\n", { mode: 0o755 });
  // Controlled authentication wrapper: it checks an environment variable without reading protocol stdin.
  const original = `SSHPASS=owned-test HOME=${quoteShell(fixture.root)} ${quoteShell(auth)}`;
  const environments = createTargetEnvironments({ resolve: () => ({ local: false, command: original }) });
  lease = await environments.acquire("auth");
  const output = [];
  const child = await openProcess(lease.connection, {
    cwd: fixture.root, argv: ["/usr/bin/env"],
    onStdout: (bytes) => output.push(Buffer.from(bytes)),
  });
  assert.equal(await child.exited, 0);
  assert.match(Buffer.concat(output).toString(), /^SSHPASS=owned-test$/m);
  console.log(JSON.stringify({ status: "PASS", kind: "controlled-auth-env-command", version: lease.info.version }));
} finally { await lease?.release(); await fixture.close(); }
