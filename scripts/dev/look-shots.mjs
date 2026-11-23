// UI shots: every screen of the workbench drawn by the real components through the mock API
// (tests/fixtures/workspace-mock.mjs), per device × colour scheme, plus an overview montage and a contrast check.
//
// Usage: node scripts/dev/look-shots.mjs --out DIR [--screens main,chat] [--tags desktop-light,...] [--jobs 4]
// Writes DIR/<screen>-<desktop|phone>-<light|dark>.png, DIR/overview.png and DIR/contrast.json. Exits non-zero on any
// page error or contrast below floor. Needs web/ deps and PI_TEST_PLAYWRIGHT / PI_TEST_CHROMIUM.
// 试色：在 worktree 改 shared/palette.js 后运行本脚本（--screens main,chat 只拍两屏更快）。
import { existsSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { startWebDev } from "../../tests/fixtures/web-dev.mjs";
import { createMockFs, loadChromium, openMockWorkbench } from "../../tests/fixtures/workspace-mock.mjs";
import { createFixture } from "./look-shots/fixture/create-fixture.mjs";
import { createScreens } from "./look-shots/screens/create-screens.mjs";
import { tokenContrast } from "./look-shots/contrast/token-contrast.mjs";
import { probeToolCard } from "./look-shots/contrast/probe-tool-card.mjs";
import { renderOverview } from "./look-shots/overview/render-overview.mjs";

const { values: opts } = parseArgs({ options: {
  out: { type: "string" }, screens: { type: "string" }, tags: { type: "string" }, jobs: { type: "string", default: "4" },
} });
if (!opts.out) { console.error("usage: node scripts/dev/look-shots.mjs --out DIR [--screens ...] [--tags ...] [--jobs N]"); process.exit(2); }
const out = resolve(opts.out);
const fixture = createFixture();
const { workers, targets, archive, models, snapshots, files, terminalReplay, routes, native } = fixture;
const SCREENS = createScreens(fixture);

const settle = (page, ms = 700) => page.mouse.move(1, 1).then(() => page.waitForTimeout(ms));
const ALL_TAGS = ["desktop-light", "desktop-dark", "phone-light", "phone-dark"];


// ── run ──
mkdirSync(out, { recursive: true });
const screens = opts.screens ? opts.screens.split(",") : Object.keys(SCREENS);
const tags = opts.tags ? opts.tags.split(",") : ALL_TAGS;
const problems = [];
const contrast = {};
{
  const server = await startWebDev("http://127.0.0.1:9");
  const browser = await loadChromium();
  const jobs = [];
  for (const screen of screens) for (const tag of tags) if (!(SCREENS[screen].phoneOnly && tag.startsWith("desktop")) && !(SCREENS[screen].desktopOnly && tag.startsWith("phone"))) jobs.push({ screen, tag });
  let next = 0;
  const shootOne = async () => {
    while (next < jobs.length) {
      const { screen, tag } = jobs[next++];
      const [device, scheme] = tag.split("-");
      const phone = device === "phone";
      const spec = SCREENS[screen];
      const file = join(out, `${screen}-${tag}.png`);
      const { context, page, problems: errors } = await openMockWorkbench(browser, server.url, {
        fs: createMockFs(files), storage: spec.storage || {}, viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: phone ? 2 : 1,
        colorScheme: scheme, mobile: phone, workers: spec.workers || workers, targets, archive, models, terminalReplay,
        snapshots: spec.snapshot ? { ...snapshots, w1: { ...snapshots.w1, ...spec.snapshot() } } : snapshots,
        routes: spec.render ? { ...routes, "/api/workers/w1/native": native("w1", spec.render) } : routes,
      });
      try {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.locator(".management-sidebar, #empty-view").first().waitFor({ state: "attached" });
        await spec.run(page, phone);
        await settle(page);
        await page.screenshot({ path: file });
        if (screen === "chat" && device === "desktop") contrast[scheme] = { card: await page.evaluate(probeToolCard), tokens: tokenContrast(scheme) };
      } catch (error) {
        errors.push(`step failed: ${error.message.split("\n").filter((line) => line.trim() && !/^\s*-\s+(retrying|waiting for element|element is visible|done scrolling|scrolling into view|attempting click)/.test(line)).slice(0, 6).join(" / ")}`);
        await page.screenshot({ path: file }).catch(() => {});
      } finally {
        await context.close();
      }
      if (errors.length) problems.push(`${screen}-${tag}: ${errors.join(" | ")}`);
      const size = existsSync(file) ? statSync(file).size : 0;
      console.log(`${screen}-${tag} ${size} B${errors.length ? ` PROBLEM ${errors.join(" | ")}` : ""}`);
      if (!size) problems.push(`${screen}-${tag}: empty screenshot`);
    }
  };
  await Promise.all(Array.from({ length: Number(opts.jobs) }, shootOne));
  await browser.close();
  await server.close();
  writeFileSync(join(out, "contrast.json"), `${JSON.stringify(contrast, null, 1)}\n`);
  // Floors: body text tokens AA 4.5 on every surface; tool-card secondary text dark >= 5.5, light >= 3.5.
  for (const [scheme, { card, tokens }] of Object.entries(contrast)) {
    const low = Object.entries(tokens).filter(([, value]) => value.min < 4.5).map(([name, value]) => `${name} ${value.min}`);
    const floor = scheme === "dark" ? 5.5 : 3.5;
    const lowCard = Object.entries(card).filter(([, value]) => value < floor).map(([name, value]) => `${name} ${value}`);
    console.log(`contrast ${scheme}: tokens min ${Math.min(...Object.values(tokens).map((value) => value.min))}, card min ${Math.min(...Object.values(card))}${low.length || lowCard.length ? ` BELOW FLOOR ${[...low, ...lowCard].join(", ")}` : ""}`);
    if (low.length || lowCard.length) problems.push(`${scheme}: contrast below floor (${[...low, ...lowCard].join(", ")})`);
  }
}

await renderOverview(out, screens, ALL_TAGS);
if (problems.length) { console.error(`${problems.length} problem(s):\n${problems.join("\n")}`); process.exit(1); }
console.log("all shots taken, no page errors");
