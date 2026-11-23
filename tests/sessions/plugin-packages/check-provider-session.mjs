import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { initializePrkHome } from "../../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../../src/gateway/host/start-host.ts";
import { prepareGatewayEnvironment } from "../../fixtures/prepare-gateway-environment.mjs";

export async function checkProviderSession(root) {
  assert(process.env.PI_TEST_PYTHON, "PI_TEST_PYTHON is required for the existing-session provider regression");
  const home = join(root, "provider-session-home");
  const { agentDir } = initializePrkHome(home);
  const owner = join(root, "live-provider");
  const ordinary = join(root, "unrelated-plugin");
  await mkdir(owner, { recursive: true });
  await mkdir(ordinary, { recursive: true });
  await mkdir(agentDir, { recursive: true });
  await writeFile(join(owner, "package.json"), JSON.stringify({ name: "@prk-tests/live-provider", type: "module", pi: { extensions: ["index.mjs"] } }));
  await writeFile(join(owner, "index.mjs"), `import {fauxProvider,fauxAssistantMessage} from ${JSON.stringify(import.meta.resolve("@earendil-works/pi-ai"))};
export default pi => { const fixture=fauxProvider({provider:"plugin-live",models:[{id:"owned"}],tokensPerSecond:100000}); fixture.setResponses([fauxAssistantMessage("BEFORE_UNRELATED_CRUD"),fauxAssistantMessage("AFTER_UNRELATED_CRUD")]); pi.registerProvider(fixture.provider); };\n`);
  await writeFile(join(ordinary, "package.json"), JSON.stringify({ name: "@prk-tests/unrelated", type: "module", pi: { extensions: ["index.mjs"] } }));
  await writeFile(join(ordinary, "index.mjs"), "export default () => {};\n");
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ packages: [{ source: owner, enabled: true, location: "gateway" }], compaction: { enabled: false }, retry: { enabled: false }, cacheWarming: "off" }), { mode: 0o600 });
  const config = parsePrkConfig({ monitor: { enabled: false }, memory: { review: false }, remoteHost: { runtime: "node" }, session: { noExtensions: false, noSkills: true, idleTimeoutMs: 60000 } }, { instances: [{ id: "owned", label: "Owned provider regression", local: true, python: process.env.PI_TEST_PYTHON, cwd: root }] });
  const host = await createGatewayHost({ cwd: home, home, model: "plugin-live/owned", thinkingLevel: "off", config, targets: config.instances });
  try {
    await prepareGatewayEnvironment(host, home, "owned");
    const created = await host.createSession({ target: "owned", cwd: root });
    const id = created.session.sessionId;
    const first = await host.session(id).submit({ requestId: "provider-before", message: "Controlled first turn" });
    assert.equal((await first.completion).status, "completed");
    assert(host.state(id).messages.some((message) => JSON.stringify(message).includes("BEFORE_UNRELATED_CRUD")));
    assert.equal((await host.pluginsInstall({ source: ordinary })).restartRequired, false);
    await host.pluginsChange({ source: ordinary, enabled: false });
    await host.pluginsUninstall({ source: ordinary, confirm: true });
    const second = await host.session(id).submit({ requestId: "provider-after", message: "Controlled second turn" });
    assert.equal((await second.completion).status, "completed");
    assert(host.state(id).messages.some((message) => JSON.stringify(message).includes("AFTER_UNRELATED_CRUD")));
    const disabled = await host.pluginsChange({ source: owner, enabled: false });
    assert.equal(disabled.restartRequired, true);
    assert((await host.modelCatalog()).models.some((model) => model.value === "plugin-live/owned"), "model selector retains the real bootstrap until restart");
    assert.equal((await host.pluginsUninstall({ source: owner, confirm: true })).restartRequired, true, "uninstall retains the restart notice without another provider registry");
    console.log("PASS provider session: same live session completes after unrelated CRUD; provider removal keeps bootstrap models and requires restart");
  } finally { await host.close(); }
}
