import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { withTargetFixture } from "../../fixtures/target-fixture.mjs";

const olderPython = process.env.PI_TEST_PYTHON38;
assert(olderPython && isAbsolute(olderPython), "PI_TEST_PYTHON38 must name an absolute Python 3.8 executable");
await withTargetFixture(async ({ config, tempRoot, onCleanup }) => {
  const host = await createGatewayHost({
    cwd: tempRoot, home: tempRoot, model: "offline/unavailable", config: parsePrkConfig({ memory: { review: false } }),
  });
  onCleanup(() => host.close());
  await host.addTarget({ target: { id: "owned", label: "Owned", local: true, cwd: tempRoot } });
  await host.editTarget({ target: { id: "owned", python: config.python } });
  assert.equal(host.getTarget("owned").python, config.python);
  await assert.rejects(host.editTarget({ target: { id: "owned", python: olderPython } }), (error) => {
    assert.equal(error.code, "INVALID_REQUEST");
    assert.equal(error.details?.reason, "python-version");
    assert.match(error.details?.version, /^3\.8\.\d+$/);
    assert.match(error.message, /Python 3\.9 or newer/);
    return true;
  });
  assert.equal(host.getTarget("owned").python, config.python, "Rejected edit must leave the selected interpreter unchanged");
});
console.log("PASS instance edit accepts the supported interpreter and rejects Python 3.8");
