import assert from "node:assert/strict";
import { test } from "node:test";
import { createPromptCapture } from "../../../src/sessions/prompt-capture/create-prompt-capture.ts";

const tool = { name: "probe", description: "Probe it.", parameters: { type: "object", properties: {} } };
const system = (text, sections = {}) => ({ role: "system", content: text, sections, toolsAdded: [tool], timestamp: 0 });
const user = (text) => ({ role: "user", content: text });
const payloads = {
  "openai-completions": (text, messages) => ({ model: "m", messages: [{ role: "system", content: text }, ...messages], tools: [{ type: "function", function: tool }] }),
  "openai-responses": (text, messages) => ({ model: "m", input: [{ role: "developer", content: text }, ...messages], tools: [{ type: "function", ...tool }] }),
  "anthropic-messages": (text, messages) => ({ model: "m", system: [{ type: "text", text }], messages, tools: [{ name: "probe", description: "Probe it.", input_schema: tool.parameters }] }),
  "google-generative-ai": (text, messages) => ({ model: "m", contents: messages, config: { systemInstruction: text, tools: [{ functionDeclarations: [{ name: "probe", description: "Probe it.", parametersJsonSchema: tool.parameters }] }] } }),
  "bedrock-converse-stream": (text, messages) => ({ modelId: "m", system: [{ text }], messages, toolConfig: { tools: [{ toolSpec: { name: "probe", description: "Probe it.", inputSchema: { json: tool.parameters } } }] } }),
};

for (const [api, build] of Object.entries(payloads)) {
  test(`${api} requests are projected to system, tools and message sizes`, () => {
    const capture = createPromptCapture();
    capture.observeContext([system("Base.", { a: "<a>one</a>", b: "<b>two</b>" })]);
    capture.observeRequest({ ...build("Base.\n\n<a>one</a>\n\n<b>two</b>", [user("hi")]), headers: { authorization: "Bearer secret" } }, { provider: "p", id: "m", api });
    const { latest } = capture.report();
    assert.deepEqual(latest.system.sections.entries, [{ key: "a", chars: 10 }, { key: "b", chars: 10 }]);
    assert.equal(latest.system.sections.baseChars, 5);
    assert.deepEqual(latest.tools.map(({ name }) => name), ["probe"]);
    assert.equal(latest.messages.count, 1);
    assert.doesNotMatch(JSON.stringify(latest), /secret/);
  });
}

test("sections are attached only when the payload carries the context's own system text", () => {
  const capture = createPromptCapture();
  capture.observeContext([system("Base.", { a: "<a>one</a>" })]);
  capture.observeRequest(payloads["anthropic-messages"]("You are Claude Code.\n\nBase.", [user("hi")]), { provider: "p", id: "m", api: "anthropic-messages" });
  assert.equal(capture.report().latest.system.sections, null);
});

test("an unprojected API reports only payload size and key names", () => {
  const capture = createPromptCapture();
  capture.observeRequest({ model: "m", context: { messages: [] }, options: {} }, { provider: "p", id: "m", api: "pi-messages" });
  const { latest } = capture.report();
  assert.deepEqual([latest.shape, latest.system, latest.tools, latest.messages, latest.payloadKeys], [null, null, null, null, ["model", "context", "options"]]);
});

test("replays do not displace the request; changes report sections, tools, and the message prefix", () => {
  const capture = createPromptCapture();
  const model = { provider: "p", id: "m", api: "openai-completions" };
  const ask = (text, messages) => { capture.observeContext([system(text.split("\n\n")[0], { a: text.split("\n\n")[1] ?? null })]); capture.observeRequest(payloads["openai-completions"](text, messages), model); };
  ask("Base.\n\n<a>one</a>", [user("1")]);
  ask("Base.\n\n<a>one</a>", [user("1")]);
  assert.deepEqual([capture.report().latest.repeats, capture.report().diff], [1, null]);
  ask("Base.\n\n<a>changed</a>", [user("1"), user("2")]);
  const { diff } = capture.report();
  assert.deepEqual(diff.sections.changed, [{ key: "a", before: 10, after: 14 }]);
  assert.deepEqual(diff.messages, { before: 1, after: 2, commonPrefix: 1, prefixStable: true });
  ask("Base.\n\n<a>changed</a>", [user("1 edited"), user("2")]);
  assert.deepEqual(capture.report().diff.messages, { before: 2, after: 2, commonPrefix: 0, prefixStable: false });
});
