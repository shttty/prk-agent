#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { ToolLibrary } from "../../src/codemode/tool-library/assemble-tool-library.ts";
import { SkillLibrary } from "../../src/sessions/skill-library/assemble-skill-library.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { createGatewayHost } from "../../src/gateway/host/start-host.ts";
import { startGateway } from "../../src/gateway/socket-server/start-listener.ts";
import { startWebApplication } from "../../src/http/application/start-application.ts";
import { startWebDev } from "../fixtures/web-dev.mjs";

const playwrightPath = process.env.PI_TEST_PLAYWRIGHT;
const chromiumPath = process.env.PI_TEST_CHROMIUM;
if (!playwrightPath || !chromiumPath) throw new Error("Set PI_TEST_PLAYWRIGHT and PI_TEST_CHROMIUM for library browser checks.");
const { chromium } = await import(pathToFileURL(playwrightPath).href);
const root = await mkdtemp(join(tmpdir(), "prk-learning-libraries-"));
const shots = process.env.PI_LEARN_SHOTS || join(tmpdir(), "prk-learning-libraries-shots");
const evidenceFor = (tag) => `Fixture evidence ${tag}: observed correction and verified result. ${"Long evidence detail ".repeat(12)}`;
const reasonFor = (tag) => `Reuse for future ${tag} data transformations with explicit numeric inputs and outputs. ${"Repeated analysis tasks. ".repeat(8)}`.trimEnd();
await mkdir(shots, { recursive: true });
let gateway;
let web;
let ui;
let browser;
try {
  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "library-browser", models: [{ id: "controlled" }], tokensPerSecond: 1000 });
  runtime.registerNativeProvider(provider.provider);

  const toolLibrary = new ToolLibrary(root);
  const skillLibrary = new SkillLibrary(root);
  const autoPromoted = toolLibrary.save({ name: "learn_auto_promoted", reason: "Reuse for future promotion lifecycle probes.", source: "def learn_auto_promoted() -> int:\n    return 1", signature: "() -> int", docstring: "Auto-promoted fixture", imports: [] });
  for (const sessionId of ["auto-session-1", "auto-session-2", "auto-session-3"]) toolLibrary.used(autoPromoted.name, autoPromoted.version, sessionId);
  toolLibrary.save({ name: "shared", reason: "Reuse for future cross-library response probes.", source: "def shared() -> int:\n    return 404", signature: "() -> int", docstring: "Tool-only detail fixture.", imports: [] });
  skillLibrary.manage({ action: "create", name: "shared", scope: "global", description: "Skill-only detail fixture.", whenToUse: "Testing delayed library responses.", evidence: "A delayed tool-list response followed a skill dialog switch.", procedure: ["Shared skill detail."], pitfalls: [], verification: [] });
  const variants = [
    ["desktop-light", { width: 1440, height: 960 }, "light"],
    ["desktop-dark", { width: 1440, height: 960 }, "dark"],
    ["phone-light", { width: 390, height: 844 }, "light"],
    ["phone-dark", { width: 390, height: 844 }, "dark"],
  ];
  for (const [tag] of variants) {
    const token = tag.replaceAll("-", "_");
    const tool = toolLibrary.save({ name: `learn_${token}`, reason: reasonFor(tag), source: `def learn_${token}(value: int) -> int:\n    return value + 1`, signature: `(value: int) -> int`, docstring: `Fixture source ${tag}`, imports: [] });
    for (let call = 0; call < 3; call++) toolLibrary.used(tool.name, tool.version, `tool-session-${tag}`);
    const skillName = `learn-${tag}`;
    const whenToUse = `Fixture applicability ${tag}`;
    const evidence = evidenceFor(tag);
    skillLibrary.manage({ action: "create", name: skillName, scope: "global", description: tag, whenToUse, evidence, procedure: [`Markdown detail ${tag}.`], pitfalls: [], verification: [] });
    skillLibrary.recordRead(join(skillLibrary.directory, skillName, "SKILL.md"), `skill-session-${tag}`);
  }

  const host = await createGatewayHost({ cwd: root, home: root, historyDir: join(root, "history"), model: "library-browser/controlled", config: parsePrkConfig({}) }, {
    runtimeDependencies: { model: provider.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: root, agentDir: root },
  });
  const socket = join(root, "gateway.sock");
  gateway = await startGateway(host, socket);
  web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
  ui = await startWebDev(web.server.url);
  browser = await chromium.launch({ executablePath: chromiumPath, headless: true, args: ["--no-sandbox"] });
  const errors = [];

  // Settings → Tools/Skills → the saved-library provider (phone: its sheet). Rows open their detail card on click.
  const openLibrary = async (page, kind, pick = true) => {
    if (page.viewportSize().width < 500) await page.locator("#open-sidebar").click();
    else if (await page.locator("#expand-session-sidebar").count()) await page.locator("#expand-session-sidebar").click();
    await page.locator("#open-settings").click();
    const settingsRow = page.locator(`#open-${kind === "tools" ? "tool" : "skill"}-library`);
    await settingsRow.waitFor({ state: "visible" });
    await settingsRow.click({ position: { x: 20, y: 20 } });
    if (!pick) return;
    const provider = page.locator(`#${kind}-sources [data-provider="${kind === "tools" ? "group:tools:library" : "group:skills:shared"}"] .capability-provider-name`);
    await provider.click();
    await page.waitForFunction(() => !document.querySelector(".pi-fade-leaving"));
    await page.locator(`#${kind}-library-list`).waitFor({ state: "visible" });
  };
  const closeSettings = async (page) => {
    if (await page.locator('.capability-layer[data-open="true"]').count()) await page.locator('#capability-sheet [data-action="close-provider"]').click();
    await page.locator("#close-settings").click();
  };
  const waitStatus = (page, rowId, status) => page.locator(`#${rowId}[data-status="${status}"]`).waitFor({ state: "visible" });
  const clickAction = async (page, kind, action) => {
    await page.locator(`#${kind}-${action}`).click();
  };
  const exerciseLifecycle = async (page, kind, rowId, tag) => {
    const row = page.locator(`#${rowId}`);
    const status = (value) => waitStatus(page, rowId, value);
    await clickAction(page, kind, "promote");
    await status("promoted");
    assert.equal(await page.locator(`#${kind}-library-detail [data-status]`).getAttribute("data-manual"), "true");
    await clickAction(page, kind, "demote");
    await status("staging");
    assert.equal(await page.locator(`#${kind}-library-detail [data-status]`).getAttribute("data-manual"), "false");
    await clickAction(page, kind, "archive");
    await status("archived");
    await clickAction(page, kind, "restore");
    await status("staging");
    await clickAction(page, kind, "delete");
    await page.locator(`#${kind}-confirm-delete`).waitFor({ state: "visible" });
    const listResponse = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/${kind}/list` && response.request().method() === "POST");
    await page.locator(`#${kind}-confirm-delete`).click();
    await page.locator(`#${kind}-delete-confirm`).waitFor({ state: "hidden" });
    const response = await listResponse;
    await response.finished();
    const list = page.locator(`#${kind}-library-list[aria-busy="false"]`);
    await list.waitFor({ state: "visible" });
    assert.equal(await list.locator(`[id="${rowId}"]`).count(), 0);
    console.log(`LIBRARY_LIFECYCLE ${kind} ${tag} promote=promoted demote=staging archive=archived restore=staging delete=detached`);
  };

  for (const [tag, viewport, scheme] of variants) {
    const phone = viewport.width < 500;
    const context = await browser.newContext({ viewport, colorScheme: scheme, isMobile: phone, hasTouch: phone });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${tag}: ${error.message}`));
    page.setDefaultTimeout(15000);
    await page.goto(ui.url);
    await page.locator(`[data-mantine-color-scheme="${scheme}"]`).waitFor();
    if (tag === "desktop-light") {
      let markStarted;
      let releaseResponse;
      const started = new Promise((resolveStarted) => { markStarted = resolveStarted; });
      const held = new Promise((resolveResponse) => { releaseResponse = resolveResponse; });
      await page.route("**/api/tools/list", async (route) => { markStarted(); await held; await route.continue(); });
      await openLibrary(page, "tools", false);
      await started;
      await closeSettings(page);
      const skillListResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/skills/list");
      await openLibrary(page, "skills");
      await skillListResponse;
      const sharedSkill = page.locator("#skills-entry-shared");
      await sharedSkill.waitFor({ state: "visible" });
      await sharedSkill.locator(".capability-copy").click();
      await page.locator("#skill-evidence").waitFor({ state: "visible" });
      const sharedEvidence = "A delayed tool-list response followed a skill dialog switch.";
      assert.equal(await page.locator("#skill-evidence").textContent(), sharedEvidence);
      const lateToolResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/tools/list");
      releaseResponse();
      const response = await lateToolResponse;
      await response.finished();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.locator("#skill-evidence").textContent(), sharedEvidence);
      await page.unroute("**/api/tools/list");
      await closeSettings(page);
    }
    await openLibrary(page, "tools");
    const toolName = `learn_${tag.replaceAll("-", "_")}`;
    const toolRow = `tools-entry-${encodeURIComponent(toolName)}`;
    const tool = page.locator(`#${toolRow}`);
    if (tag === "desktop-light") {
      const promotedRow = page.locator("#tools-entry-learn_auto_promoted");
      await promotedRow.locator(".capability-copy").click();
      assert.equal(await promotedRow.getAttribute("data-status"), "promoted");
      assert.equal(await promotedRow.locator("[data-status]").getAttribute("data-manual"), "false");
      await page.locator("#tools-promote").click();
      await page.locator('#tools-library-detail [data-status="promoted"][data-manual="true"]').waitFor({ state: "visible" });
    }
    await tool.waitFor({ state: "visible" });
    // A pinned detail card closes on a press elsewhere (the provider list header; phone: the sheet's title).
    await page.locator(phone ? "#capability-sheet .capability-group-title" : ".capability-providers-stat > span").first().click();
    await tool.locator(".capability-copy").click();
    assert.equal(await tool.getAttribute("data-status"), "staging");
    assert.equal(await page.locator("#tool-source").textContent(), `def ${toolName}(value: int) -> int:\n    return value + 1`);
    assert.equal(await page.locator('#tool-metadata [data-field="signature"]').textContent(), "(value: int) -> int");
    assert.equal(await page.locator('#tool-metadata [data-field="docstring"]').textContent(), `Fixture source ${tag}`);
    assert.equal(await page.locator("#tool-reason").textContent(), reasonFor(tag));
    assert.equal(await page.locator('#tools-library-detail [data-field="successful-calls"]').getAttribute("data-count"), "3");
    assert.equal(await page.locator('#tools-library-detail [data-field="distinct-sessions"]').getAttribute("data-count"), "1");
    assert.ok(await page.locator("#tools-library-detail").evaluate((element) => element.scrollWidth <= element.clientWidth));
    assert.ok(await page.locator('#tools-library-detail [data-field="successful-calls"]').evaluate((element) => {
      const bounds = element.closest("#tools-library-detail").parentElement.getBoundingClientRect();
      const count = element.getBoundingClientRect();
      return count.top >= bounds.top && count.bottom <= bounds.bottom;
    }), `${tag}: selecting a long-reason row keeps detail counts inside the visible library viewport`);
    await page.screenshot({ path: join(shots, `tools-${tag}.png`) });
    // Lifecycle semantics are identical across schemes; dark keeps the full detail/count/fit assertions and screenshot.
    if (scheme === "light") await exerciseLifecycle(page, "tools", toolRow, tag);

    await closeSettings(page);
    await openLibrary(page, "skills");
    const skillName = `learn-${tag}`;
    const skillRowId = `skills-entry-${encodeURIComponent(skillName)}`;
    const skillRow = page.locator(`#${skillRowId}`);
    await skillRow.waitFor({ state: "visible" });
    await skillRow.locator(".capability-copy").click();
    assert.equal(await skillRow.getAttribute("data-status"), "staging");
    assert.equal(await page.locator("#skill-when-to-use").textContent(), `Fixture applicability ${tag}`);
    assert.equal(await page.locator("#skill-evidence").textContent(), evidenceFor(tag));
    assert.ok(await page.locator("#skills-library-detail").evaluate((element) => element.scrollWidth <= element.clientWidth));
    assert.equal(await page.locator("#skills-library-detail [data-count]").getAttribute("data-count"), "1");
    assert.equal(await skillRow.locator('[data-field="successful-calls"]').count(), 0);
    assert.equal(await page.locator('#skills-library-detail [data-field="successful-calls"]').count(), 0);
    assert.ok(await page.locator("#skills-library-detail [data-last-used]").getAttribute("data-last-used"));
    assert.ok((await page.locator("#skills-library-detail").textContent()).includes(`Markdown detail ${tag}`));
    await page.screenshot({ path: join(shots, `skills-${tag}.png`) });
    if (scheme === "light") await exerciseLifecycle(page, "skills", skillRowId, tag);

    await context.close();
  }

  assert.deepEqual(errors, [], "library browser interactions produce no pageerror");
  console.log(`LEARNING_LIBRARIES_BROWSER_PASS screenshots=${variants.length * 2} pageerrors=0`);
} finally {
  await browser?.close().catch(() => {});
  await ui?.close().catch(() => {});
  await web?.close().catch(() => {});
  await gateway?.close().catch(() => {});
  await rm(root, { recursive: true, force: true });
}
