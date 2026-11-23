import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";

await withTargetFixture(async ({ tempRoot, config, onCleanup }) => {
  const host = await createGatewayHost({ cwd: tempRoot, home: tempRoot, model: "offline/unavailable",
    config: parsePrkConfig({ targetConnection: { requestTimeoutMs: 100 }, memory: { review: false } }) });
  onCleanup(() => host.close());
  const socket = join(tempRoot, "g.sock");
  const gateway = await startGateway(host, socket);
  onCleanup(() => gateway.close());
  const web = await startWebApplication({ home: tempRoot, socket, host: "127.0.0.1", port: 0 });
  onCleanup(() => web.close());
  const blockedHome = join(tempRoot, "not-a-directory");
  await writeFile(blockedHome, "owned deployment failure");
  const slow = join(tempRoot, "slow-python");
  await writeFile(slow, `#!/bin/sh\nsleep 2\nexec ${quoteShell(config.python)} "$@"\n`, { mode: 0o700 });
  for (const [reason, connection] of [
    ["connection", { local: false, sshCommand: "exit 255" }],
    ["deployment", { local: false, sshCommand: `HOME=${quoteShell(blockedHome)} exec /bin/sh` }],
    ["timeout", { local: true, python: slow }],
  ]) {
    const response = await fetch(`${web.server.url}/api/targets/inspect`, { method: "POST",
      headers: { Origin: web.server.url, "Content-Type": "application/json" }, body: JSON.stringify({ connection }) });
    const body = await response.json();
    assert.equal(response.status, 503, JSON.stringify(body));
    assert.equal(body.code, "TARGET_UNREACHABLE", JSON.stringify(body));
    assert.equal(body.details?.reason, reason, JSON.stringify(body));
  }
  assert.deepEqual(host.workbench().targets, [], "Failed draft inspections do not persist instances");
});
console.log("PASS actual HTTP inspect failures preserve connection/deployment/timeout reasons without message parsing");
