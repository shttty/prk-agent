import { stack } from "./ask-ui/stack.mjs";
import { open } from "./ask-ui/open.mjs";
import { ask } from "./ask-ui/ask.mjs";
import { checkAskLayouts } from "./ask-ui/check-ask-layouts.mjs";
import { checkAskAnswersAndTimeouts } from "./ask-ui/check-ask-answers-and-timeouts.mjs";
// The ask card in a real browser on the real path (check:full): a faux model calls `ask` in a real Pi SDK worker
// on a test Gateway, the page (real web API + Vite) shows the card, the user answers through it, and the model's next
// context carries exactly what was answered. Desktop 1440 and phone 390, light and dark; nothing here locates by UI copy
// (ids, data-ask-*, data-action). Screenshots go to PI_TEST_WEB_EVIDENCE when it is set.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { withTargetFixture } from "../fixtures/target-fixture.mjs";

const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) mkdirSync(evidence, { recursive: true });
const text = (message) => typeof message?.content === "string" ? message.content : (message?.content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(read, check, label, timeoutMs = 15_000) {
  const started = Date.now();
  for (;;) {
    const value = read();
    if (check(value)) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await sleep(25);
  }
}
const isPhone = (viewport) => viewport.width < 600;

const QUESTIONS = [
  { id: "storage", header: "Storage", question: "Which database should hold the session archive?", recommended: 1, options: [
    { label: "SQLite", description: "single file, no server" },
    { label: "Postgres", description: "networked, needs ops", preview: "## Postgres\n\n- needs a server\n- richer queries\n\n```sql\nselect count(*) from sessions;\n```" },
    { label: "DuckDB" },
  ] },
  { id: "features", header: "Features", question: "Which features ship in the first release?", multi: true, options: [
    { label: "Search", description: "across all sessions", preview: "**Search** reads every transcript." },
    { label: "Export" },
    { label: "Sync", description: "between devices" },
  ] },
  { id: "rollout", question: "How should the rollout go?", options: [{ label: "Staged" }, { label: "All at once" }] },
];

const root = await mkdtemp(join(tmpdir(), "prk-ask-ui-"));
const stacks = [];
let browser;
await withTargetFixture(async ({ config }) => {
try {
const ctx = {
  stack: (...args) => stack(ctx, ...args),
  open: (...args) => open(ctx, ...args),
  ask: (...args) => ask(ctx, ...args),
  get QUESTIONS() { return QUESTIONS; },
  get browser() { return browser; }, set browser(value) { browser = value; },
  get config() { return config; },
  get evidence() { return evidence; },
  get isPhone() { return isPhone; },
  get root() { return root; },
  get sleep() { return sleep; },
  get stacks() { return stacks; },
  get text() { return text; },
  get until() { return until; },
};
await checkAskLayouts(ctx);
await checkAskAnswersAndTimeouts(ctx);
} finally {
  await browser?.close();
  for (const entry of stacks) { try { await entry.close(); } catch { /* already closed */ } }
  await rm(root, { recursive: true, force: true });
}
});
