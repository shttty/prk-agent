import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createEnvironment } from "../create-environment.mjs";
import { createGateway } from "../create-gateway.mjs";
import { startHarness } from "./serve-harness.mjs";
import { assembleFiles } from "../../../../src/workspace/target-files/assemble-files.ts";
import { DEFAULT_WORKSPACE_OPTIONS } from "../../../../src/config/workspace/workspace-options.ts";
import { DEFAULT_REFERENCES_OPTIONS } from "../../../../src/config/references/references-options.ts";
import { DEFAULT_TARGET_CONNECTION_OPTIONS } from "../../../../src/config/target-connection/target-connection-options.ts";

/** Owned resources for the real-component run: local target environment, Gateway+HTTP, Vite harness, Chromium. */
export async function startRig(evidence) {
  await mkdir(evidence, { recursive: true });
  const logFile = join(evidence, "run.log");
  const log = async (entry) => { const line = JSON.stringify({ at: new Date().toISOString(), ...entry }); console.log(line); await appendFile(logFile, `${line}\n`); };
  await writeFile(logFile, "");
  const fixture = await createEnvironment("local");
  const files = assembleFiles({ environments: fixture.environments, workspace: DEFAULT_WORKSPACE_OPTIONS, references: DEFAULT_REFERENCES_OPTIONS, targetConnection: DEFAULT_TARGET_CONNECTION_OPTIONS });
  const rig = { fixture, evidence, log, root: fixture.root, stopped: false };
  try {
    rig.gateway = await createGateway(fixture, files);
    rig.harness = await startHarness(rig.gateway.url);
    const { chromium } = await import(pathToFileURL(process.env.PI_TEST_PLAYWRIGHT).href);
    rig.browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, args: ["--no-sandbox"] });
  } catch (error) { await closeRig(rig); throw error; }
  return rig;
}

/** Resume a paused daemon, then release every owned resource; each step is independent so one failure does not leak the rest. */
export async function closeRig(rig) {
  const errors = [];
  const attempt = async (name, run) => { try { await run?.(); } catch (error) { errors.push(`${name}: ${error.message}`); await rig.log({ cleanup: name, error: error.message }); } };
  if (rig.stoppedPid) await attempt("resume daemon", () => rig.fixture.observe(`kill -CONT ${rig.stoppedPid} 2>/dev/null || true\n`));
  await attempt("browser", () => rig.browser?.close());
  await attempt("vite", () => rig.harness?.close());
  await attempt("gateway+environment", () => (rig.gateway ? rig.gateway.close() : rig.fixture.close()));
  if (errors.length) throw new Error(`cleanup failures: ${errors.join("; ")}`);
  await rig.log({ cleanup: "complete" });
}
