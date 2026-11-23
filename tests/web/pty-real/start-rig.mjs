import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createPtyBrowserFixture } from "../../fixtures/pty-browser/create-fixture.mjs";
import { startHarness } from "./serve-harness.mjs";
import { startPreview } from "./serve-preview.mjs";

/** Owned resources for a real run: PTY fixture (Gateway+HTTP+local daemon), the web (Vite dev harness by default, or with
 * `preview` the production build served by vite preview), Chromium. `http` is passed to the fixture's web server. */
export async function startRig(evidence, { preview = false, webRoot, http } = {}) {
  await mkdir(evidence, { recursive: true });
  const logFile = join(evidence, "run.log");
  await writeFile(logFile, "");
  const log = async (entry) => { const line = JSON.stringify({ at: new Date().toISOString(), ...entry }); console.log(line); await appendFile(logFile, `${line}\n`); };
  const fixture = await createPtyBrowserFixture({ log: (value) => void log({ fixture: value }), ...(http ? { http } : {}) });
  const rig = { fixture, evidence, log };
  try {
    rig.harness = preview ? await startPreview(fixture.url, { ...(webRoot ? { webRoot } : {}) }) : await startHarness(fixture.url);
    await log({ web: preview ? "production build + vite preview" : "vite dev harness", url: rig.harness.url, webRoot: webRoot ?? "candidate web/" });
    const { chromium } = await import(pathToFileURL(process.env.PI_TEST_PLAYWRIGHT).href);
    rig.browser = await chromium.launch({ executablePath: process.env.PI_TEST_CHROMIUM, args: ["--no-sandbox"] });
  } catch (error) { await closeRig(rig); throw error; }
  return rig;
}

/** Each release is independent so one failure does not leak the rest. */
export async function closeRig(rig) {
  const errors = [];
  const attempt = async (name, run) => { try { await run?.(); } catch (error) { errors.push(`${name}: ${error.message}`); await rig.log({ cleanup: name, error: error.message }); } };
  await attempt("browser", () => rig.browser?.close());
  await attempt("vite", () => rig.harness?.close());
  await attempt("fixture", () => rig.fixture.close());
  if (errors.length) throw new Error(`cleanup failures: ${errors.join("; ")}`);
  await rig.log({ cleanup: "complete" });
}
