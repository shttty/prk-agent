// Real Gateway, Pi before_provider_request + loopback HTTP and owned Jupyter; no paid model.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { checkBusinessGroups } from "./business-plugins/check-business-groups.mjs";

const { values } = parseArgs({ options: { repo: { type: "string" }, output: { type: "string" } } });
assert(process.env.JUPYTER_URL === undefined && process.env.JUPYTER_TOKEN === undefined, "Business plugin acceptance requires an owned Jupyter server");
const repo = values.repo ? resolve(values.repo) : fileURLToPath(new URL("../..", import.meta.url));
const load = (path) => import(pathToFileURL(join(repo, path)).href);
const { initializePrkHome } = await load("src/config/home/initialize-prk-home.ts");
const { assemblePromptFixture } = await load("tests/sessions/prompt-sections/assemble-prompt-fixture.mjs");
const { withTargetFixture } = await load("tests/fixtures/target-fixture.mjs");
const home = await mkdtemp(join(tmpdir(), "prk-business-plugins-"));
const keys = ["HOME", "PRK_HOME", "PRK_CODING_AGENT_DIR", "PI_CODING_AGENT_DIR", "PRK_PROMPT_CAPTURE_FILE"];
const previous = new Map(keys.map((key) => [key, process.env[key]]));
process.env.HOME = join(home, "user-home");
process.env.PRK_HOME = home;
const { agentDir } = initializePrkHome(home);
try {
  await mkdir(process.env.HOME);
  const { SkillLibrary } = await load("src/sessions/skill-library/assemble-skill-library.ts");
  new SkillLibrary(home).manage({ action: "create", name: "business-skill", scope: "global", description: "Explicit isolated business integration skill", whenToUse: "Checking real loaded skill execution", evidence: "The B1 integration exercises skill plugin enable and lazy transitions.", procedure: ["Inspect BUSINESS_SKILL_READ_71039."], pitfalls: [], verification: [] });
  await withTargetFixture(async (jupyter) => {
    const fixture = await assemblePromptFixture({ home, agentDir, ...jupyter, workerTools: "direct", noSkills: false, capabilities: {} });
    const worker = (await fixture.host.createSession({ target: "fixture", label: "Business plugins" })).session.sessionId;
    fixture.host.setSessionRoot({ sessionId: worker });
    const results = await checkBusinessGroups(fixture, worker, home);
    const report = { ok: true, repo, provider: "owned HTTP stub + unmodified Pi openai-responses", results };
    if (values.output) {
      await mkdir(values.output, { recursive: true });
      await writeFile(join(values.output, "business-plugins.json"), `${JSON.stringify(report, null, 2)}\n`);
    }
    console.log(JSON.stringify(report));
  });
} finally {
  for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  await rm(home, { recursive: true, force: true });
}
