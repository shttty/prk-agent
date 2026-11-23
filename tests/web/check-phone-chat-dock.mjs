import { checkComposerAndTranscript } from "./phone-chat-dock/check-composer-and-transcript.mjs";
import { checkKeyboardAndDock } from "./phone-chat-dock/check-keyboard-and-dock.mjs";
// Phone (390x844) checks on the mocked workbench: the floating jump-to-bottom button (data-kind away / new, out of flow),
// the headerless terminal panel with its left slide-out drawer and top-edge touch splitter (95% height cap, still
// draggable down when maxed), and the monitor sheet / file browser mutual exclusion. Screenshots go to PI_TEST_WEB_EVIDENCE.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { SNAPSHOTS, SESSIONS } from "../fixtures/workspace-mock/session-snapshots.mjs";
import { assertUniqueIds } from "../fixtures/workspace-mock/assert-unique-ids.mjs";
import { createMockFs } from "../fixtures/workspace-mock/create-mock-fs.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";

const G = 1024 ** 3;
const now = Date.now();
const reply = Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1}: a long reply that has to be scrolled through to reach its end.`).join("\n\n");
const messages = [
  { role: "user", content: [{ type: "text", text: "long please" }], timestamp: now - 9000 },
  { role: "assistant", content: [{ type: "text", text: reply }], timestamp: now - 6000, stopReason: "stop" },
];
const monitor = { state: "ok", intervalMs: 30000, alerts: { kernel: false, oom: false, memory: false }, machine: { cpu: { pct: 12.4, cores: 8 }, load: [0.5, 0.6, 0.7], mem: { total: 16 * G, available: 6 * G }, disk: { total: 500 * G, free: 200 * G }, gpus: [], ageMs: 4000 }, changes: { source: "git", added: 0, removed: 0, truncated: false, ageMs: 1000, files: [] } };
const sessions = SESSIONS.map((worker) => (worker.sessionId === "w1" ? { ...worker, monitor } : worker));
const snapshots = { ...SNAPSHOTS, w1: { ...SNAPSHOTS.w1, messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };
const evidence = process.env.PI_TEST_WEB_EVIDENCE;
if (evidence) mkdirSync(evidence, { recursive: true });

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  for (const scheme of ["light", "dark"]) {
const ctx = {
  get browser() { return browser; },
  get evidence() { return evidence; },
  get scheme() { return scheme; },
  get server() { return server; },
  get sessions() { return sessions; },
  get snapshots() { return snapshots; },
};
await checkComposerAndTranscript(ctx);
await checkKeyboardAndDock(ctx);
}
} finally {
  await browser.close();
  await server.close();
}
