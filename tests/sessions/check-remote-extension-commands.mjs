// Real linked Pi package and Gateway discovery; no model requests or target host.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";

const root = await mkdtemp(join(tmpdir(), "prk-extension-commands-"));
const previousHome = process.env.HOME;
process.env.HOME = join(root, "home");
const home = join(root, "prk");
const { agentDir } = initializePrkHome(home);
let host;
try {
  await mkdir(process.env.HOME);
  await mkdir(agentDir, { recursive: true });
  const source = join(root, "plugin");
  await mkdir(source);
  const expected = [
    { name: "first_command", description: "Command from the first entry" },
    { name: "second_command", description: "Command from the second entry" },
  ];
  const entries = ["first.ts", "second.ts", "empty.ts"];
  await writeFile(join(source, "package.json"), JSON.stringify({
    name: "@prk-tests/extension-commands", version: "1.0.0", private: true, type: "module", pi: { extensions: entries },
  }));
  for (const [index, command] of expected.entries()) {
    await writeFile(join(source, entries[index]), `export default pi => pi.registerCommand(${JSON.stringify(command.name)}, { description: ${JSON.stringify(command.description)}, async handler() {} });\n`);
  }
  await writeFile(join(source, entries[2]), "export default function() {}\n");
  await writeFile(join(agentDir, "models.json"), JSON.stringify({ providers: { owned: { api: "openai-completions", baseUrl: "http://127.0.0.1:1", apiKey: "owned-fixture", models: [{ id: "controlled", name: "Controlled" }] } } }));
  host = await createGatewayHost({ cwd: home, home, model: "owned/controlled", thinkingLevel: "off", config: parsePrkConfig({ monitor: { enabled: false }, memory: { review: false } }) });
  const result = await host.pluginsInstall({ source });
  assert.equal(result.packages.length, 1);
  assert.equal(result.packages[0].source, source);
  assert.equal(result.packages[0].location, "gateway");
  assert.deepEqual(result.packages[0].commands, expected, "Native entry-point metadata preserves both commands after the final command-free entry");
  assert.equal(result.packages[0].error, undefined);
  console.log("PASS plugin commands: real Gateway discovery accumulates native package entry commands; empty final entry does not erase them");
} finally {
  await host?.close();
  if (previousHome === undefined) delete process.env.HOME;
  else process.env.HOME = previousHome;
  await rm(root, { recursive: true, force: true });
}
