import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { ArtifactStore } from "../../src/artifacts/store/assemble-store.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { discoverTargetResources } from "../../src/sessions/target-resources/discover.ts";
import { quoteShell } from "../../src/target-environment/daemon/quote-shell.mjs";
import { prepareNativeToolArtifacts } from "../fixtures/native-tool-artifacts.mjs";
import { createHostFixture } from "./host/create-host-fixture.mjs";

const mode = process.argv[2] ?? "local";
const home = await mkdtemp(join(tmpdir(), "prk-S5-resources-"));
const store = new ArtifactStore(join(home, "assets"));
const config = parsePrkConfig({ session: { noContextFiles: false, noPromptTemplates: false },
  monitor: { fastIntervalMs: 500, slowIntervalMs: 60000, historyWindowMs: 60000 } });
const owned = await createHostFixture(mode, store);
const lease = owned.channels.acquire(owned.id);
try {
  const cwd = `${owned.fixture.root}/project`;
  console.log(JSON.stringify({ phase: "resources-start", mode, root: owned.fixture.root }));
  await prepareNativeToolArtifacts(home);
  await owned.fixture.observe(`mkdir -p ${quoteShell(`${cwd}/${CONFIG_DIR_NAME}/skills/owned`)} ${quoteShell(`${cwd}/${CONFIG_DIR_NAME}/prompts`)}\n`);
  await owned.write("project/AGENTS.md", "OWNED_TARGET_CONTEXT\n");
  await owned.write(`project/${CONFIG_DIR_NAME}/skills/owned/SKILL.md`, "---\nname: owned\ndescription: Owned target skill\n---\nBODY_MUST_NOT_BECOME_METADATA\n");
  await owned.write(`project/${CONFIG_DIR_NAME}/prompts/owned.md`, "---\ndescription: Owned prompt\n---\nOWNED_TARGET_PROMPT\n");
  await owned.write(`project/${CONFIG_DIR_NAME}/settings.json`, "{}\n");
  const discover = (options = config.session, limits = config.limits) => discoverTargetResources(lease, cwd, join(home, "agent"), limits, options, store);
  const resources = await discover();
  assert(resources.agentsFiles.some((file) => file.content.includes("OWNED_TARGET_CONTEXT")));
  assert(resources.skills.skills.some((skill) => skill.name === "owned" && skill.filePath.startsWith(cwd)));
  assert(resources.prompts.some((prompt) => prompt.name === "owned" && prompt.content.includes("OWNED_TARGET_PROMPT")));
  assert.equal(JSON.stringify(resources).includes("BODY_MUST_NOT_BECOME_METADATA"), false);
  const disabled = await discover({ ...config.session, noSkills: true, noContextFiles: true, noPromptTemplates: true });
  assert.equal(disabled.skills.skills.length, 0);
  assert.equal(disabled.agentsFiles.length, 0);
  assert.equal(disabled.prompts.length, 0);
  await assert.rejects(discover(config.session, { ...config.limits, contextFileBytes: 8, contextTotalBytes: 16 }), /limit|budget/i);
  console.log(JSON.stringify({ status: "PASS", mode, resourceCwd: cwd, noSkills: true, boundedResources: true, identity: await owned.identity() }));
} finally {
  await lease.release();
  await owned.close();
  await rm(home, { recursive: true, force: true });
}
