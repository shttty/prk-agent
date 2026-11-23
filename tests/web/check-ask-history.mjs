// An ask call's tool row in a reloaded transcript (mocked API): expanding it shows each question and its answer from the
// call arguments + the result's structured record, never the raw JSON. Nothing here locates by UI copy: ids, data-*
// and test-authored data only.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { startWebDev } from "../fixtures/web-dev.mjs";
import { openMockWorkbench } from "../fixtures/workspace-mock.mjs";
import { loadChromium } from "../fixtures/workspace-mock/load-chromium.mjs";
import { selectSession } from "../fixtures/workspace-mock/select-session.mjs";
import { snapshotOf } from "../fixtures/workspace-mock/session-snapshots.mjs";

const now = Date.now();
const QUESTIONS = [
  { id: "db", header: "Storage", question: "Which database should hold the archive?", options: [{ label: "SQLite" }, { label: "Postgres" }] },
  { id: "features", question: "Which features ship first?", multi: true, options: [{ label: "Search" }, { label: "Export" }, { label: "Sync" }] },
  { id: "zone", question: "Which time zone?", options: [{ label: "UTC" }] },
];
const call = (id, questions, step) => ({ role: "assistant", content: [{ type: "toolCall", id, name: "ask", arguments: { questions } }], timestamp: now + step * 10, stopReason: "toolUse" });
const result = (id, text, details, step, isError = false) => ({ role: "toolResult", toolCallId: id, toolName: "ask", content: [{ type: "text", text }], ...(details ? { details } : {}), isError, timestamp: now + step * 10 + 5 });
const messages = [
  { role: "user", content: [{ type: "text", text: "plan it" }], timestamp: now - 100 },
  call("a1", QUESTIONS, 1),
  result("a1", "User answers:\n(model-side text, not shown)", { outcome: "answers", answers: [
    { id: "db", selected: ["Postgres"], note: "use v16" },
    { id: "features", selected: ["Search", "Sync"], custom: "Audit log" },
    { id: "zone", selected: [], autoSelected: true },
  ] }, 1),
  call("a2", QUESTIONS.slice(0, 1), 2), result("a2", "User chose to chat about this instead of answering.", { outcome: "chat" }, 2),
  call("a3", QUESTIONS.slice(0, 1), 3), result("a3", "User cancelled the questions without answering.", { outcome: "cancelled" }, 3),
  call("a4", QUESTIONS.slice(0, 1), 4), result("a4", "Option labels must not collide with the reserved rows", undefined, 4, true),
  { role: "assistant", content: [{ type: "text", text: "TURN_DONE" }], timestamp: now + 100, stopReason: "stop" },
  call("a5", QUESTIONS.slice(0, 1), 11),
];
const sessions = [{ label: "asking worker", sessionId: "m1", state: "idle", target: "alpha", cwd: "/data" }];
const snapshots = { m1: { ...snapshotOf("m1", "idle"), messages, messageEntryIds: messages.map((_, index) => `e${index}`) } };

const server = await startWebDev("http://127.0.0.1:9");
const browser = await loadChromium();
try {
  for (const phone of [false, true]) {
    const label = phone ? "phone" : "desktop";
    const { context, page, problems } = await openMockWorkbench(browser, server.url, { sessions, snapshots, ...(phone ? { viewport: { width: 390, height: 844 }, mobile: true } : {}) });
    if (phone) await page.locator("#open-sidebar").click();
    await selectSession(page, "m1");
    await page.locator("details.pi-turn-process").first().waitFor();
    const turn = page.locator("details.pi-turn-process").first();
    if (!await turn.evaluate((node) => node.open)) await turn.locator(":scope > summary").click();
    for (const summary of await page.locator(".pi-tool[data-tool-name='ask'] > summary").all()) { await summary.click(); await page.waitForTimeout(80); }
    const row = (id) => page.locator(`.pi-tool[data-tool-key$=":${id}"]`);
    const text = (id) => row(id).locator(".pi-ask-record").textContent();

    assert.equal(await page.locator(".pi-tool[data-tool-name='ask']").count(), 5, `${label}: every ask call is a row`);
    assert.ok((await row("a1").locator("summary .pi-tool-args").textContent()).includes("Which database should hold the archive?"), `${label}: the collapsed row names the question`);

    // Answered: each question with its answer, the note and the timeout mark; no JSON, no model-side text.
    const a1 = row("a1");
    assert.equal(await a1.locator(".pi-ask-record").getAttribute("data-outcome"), "answers");
    assert.deepEqual(await a1.locator("[data-ask-record]").evaluateAll((nodes) => nodes.map((node) => [node.dataset.askRecord, node.dataset.answered])), [["db", "true"], ["features", "true"], ["zone", "false"]]);
    const db = await a1.locator('[data-ask-record="db"]').textContent();
    assert.ok(db.includes("Storage") && db.includes("Which database should hold the archive?") && db.includes("Postgres") && db.includes("use v16"), `${label}: db row: ${db}`);
    const features = await a1.locator('[data-ask-record="features"]').textContent();
    assert.ok(features.includes("Search、Sync") && features.includes("Audit log"), `${label}: features row: ${features}`);
    assert.equal(await a1.locator('[data-ask-record="zone"] [data-auto="true"]').count(), 1, `${label}: timed-out answer is marked`);
    const whole = await row("a1").locator(".pi-tool-body").textContent();
    assert.ok(!whole.includes('"questions"') && !whole.includes("model-side text"), `${label}: neither the raw call JSON nor the model-side result text is shown`);
    assert.equal(await a1.locator(".pi-output-block").count(), 0, `${label}: no separate raw output`);

    assert.equal(await row("a2").locator(".pi-ask-record").getAttribute("data-outcome"), "chat");
    assert.equal(await row("a2").locator('[data-kind="ask-chat"]').count(), 1);
    assert.equal(await row("a3").locator('.pi-ask-record[data-outcome="cancelled"] [data-kind="ask-cancelled"]').count(), 1);
    // A result without the record (the tool refused the call) keeps its error text.
    assert.equal(await row("a4").locator(".pi-ask-record").getAttribute("data-outcome"), "unknown");
    assert.ok((await row("a4").locator(".pi-output-block").textContent()).includes("reserved rows"), `${label}: an error result still prints`);
    // No result yet: the question is shown, nothing is claimed.
    assert.equal(await row("a5").locator(".pi-ask-record").getAttribute("data-outcome"), "waiting");
    assert.equal(await row("a5").locator("[data-ask-record]").count(), 1);
    assert.equal(await row("a5").locator(".pi-output-block").count(), 0);
    assert.ok((await text("a5")).includes("Which database should hold the archive?"));
    assert.deepEqual(problems, [], `${label}: page errors`);
    if (process.env.PI_TEST_WEB_EVIDENCE) { mkdirSync(process.env.PI_TEST_WEB_EVIDENCE, { recursive: true }); await row("a1").scrollIntoViewIfNeeded(); await page.screenshot({ path: join(process.env.PI_TEST_WEB_EVIDENCE, `ask-history-${label}.png`) }); }
    await context.close();
    console.log(`PASS ${label}: ask rows in history show questions and answers, not JSON`);
  }
} finally {
  await browser.close();
  await server.close();
}
