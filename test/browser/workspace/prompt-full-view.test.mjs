import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { browserFixture } from "../../fixtures/browser/open-workbench.mjs";
import { openPromptPanel } from "../../fixtures/browser/open-prompt-panel.mjs";
import { startCompletionsEndpoint } from "../../fixtures/models/start-completions-endpoint.mjs";
import { createPromptCapture } from "../../../src/sessions/prompt-capture/create-prompt-capture.ts";
import { listPromptTools } from "../../../src/sessions/prompt-capture/list-prompt-tools.ts";
import { pagePromptMessages } from "../../../src/sessions/prompt-capture/page-prompt-messages.ts";

test("the panel opens a tool's declaration, follows each new request by itself and downloads the raw request", async (t) => {
  const endpoint = await startCompletionsEndpoint(t);
  const f = await browserFixture(t, { endpoint, config: { session: { workerTools: "code" } } });
  const id = await f.create();
  const turn = async (message) => assert.equal((await f.complete(id, await f.send(id, message))).status, "completed");
  await turn("First question");
  await turn("Second question");
  await f.open(id);
  const panel = await openPromptPanel(f.page);
  const summary = panel.locator('[data-field="summary"]');
  await panel.locator('[data-field="summary"][data-seq="2"]').waitFor();

  const tool = panel.locator('[data-tool-name="kernel_code"]');
  await tool.locator("button").click();
  assert.match(await tool.locator('[data-field="exposure"]').innerText(), /model-only/);
  const declaration = await tool.locator("pre").innerText();
  assert.match(declaration, /"name": "kernel_code"/);
  assert.match(declaration, /"parameters": \{/);

  const open = panel.locator('[data-message-index][data-open="true"]');
  assert.match(await open.last().innerText(), /Second question/);
  const [download] = await Promise.all([f.page.waitForEvent("download"), panel.locator('[data-action="download-prompt"]').click()]);
  assert.equal(download.suggestedFilename(), "prompt-request-2.json");
  assert.deepEqual(JSON.parse(await readFile(await download.path(), "utf8")), endpoint.bodies[1]);

  await turn("Third question");
  await panel.locator('[data-field="summary"][data-seq="3"]').waitFor();
  assert.match(await summary.innerText(), /第 3 次请求/);
  assert.match(await open.last().innerText(), /Third question/);
  assert.equal(await panel.locator("[data-message-index]").count(), endpoint.bodies[2].messages.length - 1);
});

const model = { provider: "p", id: "claude", api: "anthropic-messages" };
const text = (value, extra = {}) => ({ type: "text", text: value, ...extra });
const tools = [{ name: "read", description: "Read a file.\nSecond line of the description.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }];

/** The two requests a long session would send: 128 messages, then the same 128 plus a turn that holds hidden injections, thinking, a tool call and a cache marker. */
function longSession() {
  const earlier = Array.from({ length: 128 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: [text(`message number ${index}`)] }));
  const turn = [
    { role: "user", content: [text("<memory-context>\nrecalled fact about the user\n</memory-context>")] },
    { role: "user", content: [text("<persona_guard>stay in character</persona_guard>")] },
    { role: "user", content: [text("What does the file say?")] },
  ];
  const work = [
    { role: "assistant", content: [{ type: "thinking", thinking: "I should read the file." }, { type: "tool_use", id: "t1", name: "read", input: { path: "a.txt" } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "file body", cache_control: { type: "ephemeral" } }] },
  ];
  const capture = createPromptCapture();
  const ask = (messages) => capture.observeRequest({ model: "claude", system: [text("System.")], tools, messages }, model);
  ask(earlier.slice(0, 126).concat(turn.slice(0, 2)));
  ask([...earlier.slice(0, 126), ...turn, ...work]);
  return capture;
}

test("a long conversation is read a page at a time from the newest; the last turn is open with its hidden injections, and new messages are marked", async (t) => {
  const f = await browserFixture(t, { endpoint: await startCompletionsEndpoint(t) });
  const id = await f.create();
  const capture = longSession();
  await f.page.route((url) => url.pathname.startsWith(`/api/sessions/${id}/prompt`), (route) => {
    const url = new URL(route.request().url());
    const part = url.pathname.slice(`/api/sessions/${id}/prompt`.length);
    const body = capture.body();
    const json = part === "" ? { sessionId: id, ...capture.report() }
      : part === "/tools" ? { sessionId: id, ...listPromptTools(body, () => "direct") }
        : { sessionId: id, ...pagePromptMessages(body, Number(url.searchParams.get("offset")), Number(url.searchParams.get("limit"))) };
    return route.fulfill({ json });
  });
  await f.open(id);
  const panel = await openPromptPanel(f.page);
  const rows = panel.locator("[data-message-index]");
  await rows.last().waitFor();
  assert.equal(await rows.count(), 50);
  assert.equal(await rows.first().getAttribute("data-message-index"), String(131 - 50));

  const more = panel.locator('[data-action="load-earlier-messages"]');
  assert.match(await more.innerText(), /81/);
  await more.click();
  await panel.locator('[data-message-index="31"]').waitFor();
  assert.equal(await rows.count(), 100);
  await more.click();
  await panel.locator('[data-message-index="0"]').waitFor();
  assert.equal(await rows.count(), 131);
  assert.equal(await more.count(), 0);

  const open = panel.locator('[data-message-index][data-open="true"]');
  const shown = await open.evaluateAll((nodes) => nodes.map((node) => node.textContent));
  assert.match(shown.join("\n"), /recalled fact about the user/);
  assert.match(shown.join("\n"), /stay in character/);
  assert.match(shown.join("\n"), /I should read the file\./);
  assert.equal(await panel.locator('[data-message-index="10"][data-open="true"]').count(), 0, "earlier messages stay folded");
  assert.deepEqual(await panel.locator('[data-mark="新增"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-message-index"))), ["128", "129", "130"]);
  assert.match(await panel.locator('[data-message-index="130"]').innerText(), /cache/);
  assert.match(await panel.locator('[data-message-index="129"]').innerText(), /thinking tool_use/);

  await panel.locator('[data-tool-name="read"] button').click();
  const declaration = await panel.locator('[data-tool-name="read"] pre').innerText();
  assert.match(declaration, /"input_schema": \{/);
  assert.match(declaration, /Read a file\.\n\s+Second line/);
});
