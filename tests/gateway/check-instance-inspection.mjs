import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parse } from "smol-toml";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";

await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
  const marker = join(tempRoot, "inspecting"), release = join(tempRoot, "release");
  const python = join(tempRoot, "slow-python");
  await writeFile(python, `#!/bin/sh\nprintf ready > ${quoteShell(marker)}\nwhile ! test -f ${quoteShell(release)}; do sleep 0.02; done\nexec ${quoteShell(config.python)} "$@"\n`, { mode: 0o700 });
  const host = await createGatewayHost({ cwd: tempRoot, home: tempRoot, model: "offline/unavailable", config: parsePrkConfig({ memory: { review: false } }) });
  onCleanup(() => host.close());
  await host.addTarget({ target: { id: "owned", label: "Original", local: true, cwd: tempRoot } });
  const pending = host.editTarget({ target: { id: "owned", python } }).then((value) => ({ value }), (error) => ({ error }));
  try {
    const deadline = Date.now() + 10000;
    while (!existsSync(marker) && Date.now() < deadline) await delay(10);
    assert(existsSync(marker), "Real target interpreter validation reached the owned blocking wrapper");
    await host.editTarget({ target: { id: "owned", label: "Concurrent label" } });
    await writeFile(release, "release");
    const result = await pending;
    assert.equal(result.error?.code, "CONFLICT", "Slow validation cannot overwrite a newer persisted instance");
    const saved = parse(await readFile(join(tempRoot, "instances.toml"), "utf8")).instances[0];
    assert.equal(saved.label, "Concurrent label");
    assert.equal(saved.python, undefined);
    assert.equal(host.getTarget("owned").label, "Concurrent label");
  } finally { await writeFile(release, "release"); await pending; }
  await host.close();
  const bounded = await createGatewayHost({ cwd: tempRoot, home: tempRoot, model: "offline/unavailable", config: parsePrkConfig({ targetConnection: { requestTimeoutMs: 100 }, memory: { review: false } }) });
  onCleanup(() => bounded.close());
  const slow = join(tempRoot, "timeout-python");
  await writeFile(slow, `#!/bin/sh\nsleep 2\nexec ${quoteShell(config.python)} "$@"\n`, { mode: 0o700 });
  await assert.rejects(bounded.inspectTarget({ connection: { local: true, cwd: tempRoot, python: slow } }), (error) => error.code === "TARGET_UNREACHABLE" && error.details?.reason === "timeout");
});
console.log("PASS instance inspection: concurrent persisted edits survive slow validation, and full inspection has a target deadline");
