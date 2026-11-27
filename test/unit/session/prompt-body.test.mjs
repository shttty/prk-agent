import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createPromptCapture } from "../../../src/sessions/prompt-capture/create-prompt-capture.ts";
import { listPromptTools } from "../../../src/sessions/prompt-capture/list-prompt-tools.ts";
import { pagePromptMessages } from "../../../src/sessions/prompt-capture/page-prompt-messages.ts";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex").slice(0, 12);
const png = Buffer.from("not really a png but bytes all the same");
const base64 = png.toString("base64");
const placeholder = { mime: "image/png", bytes: png.length, sha256: sha(png) };
const model = (api) => ({ provider: "p", id: "m", api });
const schema = { type: "object", properties: { path: { type: "string" } }, required: ["path"] };

const shapes = {
  "openai-completions": { image: { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } }, seen: (message) => message.content[1].image_url.url },
  "openai-responses": { image: { type: "input_image", image_url: `data:image/png;base64,${base64}` }, seen: (message) => message.content[1].image_url },
  "anthropic-messages": { image: { type: "image", source: { type: "base64", media_type: "image/png", data: base64 } }, seen: (message) => message.content[1].source.data },
  "google-generative-ai": { image: { inlineData: { mimeType: "image/png", data: base64 } }, seen: (message) => message.parts[1].inlineData.data },
  "bedrock-converse-stream": { image: { image: { format: "png", source: { bytes: new Uint8Array(png) } } }, seen: (message) => message.content[1].image.source.bytes },
};

for (const [api, { image, seen }] of Object.entries(shapes)) {
  test(`${api}: an image is kept as {mime, bytes, sha256}, never as base64`, () => {
    const capture = createPromptCapture();
    const text = { type: "text", text: "look" };
    const message = api === "google-generative-ai" ? { role: "user", parts: [{ text: "look" }, image] } : { role: "user", content: [text, image] };
    const payload = api === "google-generative-ai" ? { contents: [message], config: {} } : api === "openai-responses" ? { input: [message] } : { messages: [message] };
    capture.observeRequest(payload, model(api));
    const stored = capture.body().payload;
    const entryOf = (body) => (body.messages ?? body.input ?? body.contents)[0];
    assert.deepEqual(seen(entryOf(stored)), placeholder);
    assert.equal(JSON.stringify(stored).includes(base64.slice(0, 40)), false);
    assert.equal(capture.report().latest.messages.count, 1);
    // The payload the provider sends is left as it was.
    assert.notDeepEqual(seen(entryOf(payload)), placeholder);
  });
}

test("the stored body is a copy: later changes to the payload do not reach it, and nothing is added to it", () => {
  const capture = createPromptCapture();
  const payload = { model: "m", messages: [{ role: "system", content: "S" }, { role: "user", content: "hi" }], tools: [{ type: "function", function: { name: "read", description: "Read.", parameters: schema } }] };
  const sent = structuredClone(payload);
  capture.observeRequest(payload, model("openai-completions"));
  payload.messages[1].content = "changed afterwards";
  assert.deepEqual(capture.body(), { seq: 1, at: capture.report().latest.at, shape: "chat", payload: sent });
});

test("tool declarations come back exactly as the payload holds them, in every shape", () => {
  const declared = {
    "openai-completions": { tools: [{ type: "function", function: { name: "read", description: "Read.", parameters: schema, strict: true } }] },
    "openai-responses": { tools: [{ type: "function", name: "read", description: "Read.", parameters: schema, strict: null }] },
    "anthropic-messages": { tools: [{ name: "read", description: "Read.", input_schema: schema, cache_control: { type: "ephemeral" } }] },
    "google-generative-ai": { config: { tools: [{ functionDeclarations: [{ name: "read", description: "Read.", parametersJsonSchema: schema }] }] } },
    "bedrock-converse-stream": { toolConfig: { tools: [{ toolSpec: { name: "read", description: "Read.", inputSchema: { json: schema } } }] } },
  };
  for (const [api, payload] of Object.entries(declared)) {
    const capture = createPromptCapture();
    capture.observeRequest({ model: "m", messages: [], ...payload }, model(api));
    const raw = payload.tools ?? payload.config?.tools[0].functionDeclarations ?? payload.toolConfig.tools;
    const part = listPromptTools(capture.body(), (name) => (name === "read" ? "direct" : null));
    assert.deepEqual(part.tools, [{ name: "read", exposure: "direct", declaration: raw[0] }], api);
  }
});

test("an API whose payload is not projected has no tools or messages to page, only its raw body", () => {
  const capture = createPromptCapture();
  capture.observeRequest({ model: "m", context: { messages: [] } }, model("pi-messages"));
  assert.deepEqual(listPromptTools(capture.body(), () => null).tools, []);
  const page = pagePromptMessages(capture.body(), 0, 50);
  assert.deepEqual([page.shape, page.total, page.messages, page.turnStart], [null, 0, [], null]);
  assert.deepEqual(capture.body().payload, { model: "m", context: { messages: [] } });
});

const entries = Array.from({ length: 7 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `message ${index}` }));
const request = (messages) => { const capture = createPromptCapture(); capture.observeRequest({ model: "m", messages: [{ role: "system", content: "S" }, ...messages] }, model("openai-completions")); return capture.body(); };

test("pages cover the conversation without the system entry and stop at its end", () => {
  const body = request(entries);
  const page = (offset, limit) => pagePromptMessages(body, offset, limit);
  assert.deepEqual([page(0, 3).messages, page(0, 3).total], [entries.slice(0, 3), 7]);
  assert.deepEqual(page(5, 3).messages, entries.slice(5));
  assert.deepEqual(page(6, 1).messages, [entries[6]]);
  assert.deepEqual([page(7, 3).messages, page(7, 3).outline, page(7, 3).total], [[], [], 7]);
  assert.deepEqual(page(500, 3).messages, []);
  assert.equal(page(0, 200).messages.length, 7);
  assert.deepEqual(page(2, 2).outline.map(({ role }) => role), ["user", "assistant"]);
});

test("the last user turn starts at the first of the user inputs that close the list, tool results excluded", () => {
  const anthropic = (messages) => { const capture = createPromptCapture(); capture.observeRequest({ model: "m", messages }, model("anthropic-messages")); return pagePromptMessages(capture.body(), 0, 50); };
  const user = (text) => ({ role: "user", content: [{ type: "text", text }] });
  const result = { role: "user", content: [{ type: "tool_result", tool_use_id: "1", content: "ok" }] };
  const call = { role: "assistant", content: [{ type: "thinking", thinking: "t" }, { type: "tool_use", id: "1", name: "x", input: {} }] };
  assert.equal(anthropic([user("a"), call, result]).turnStart, 0);
  assert.equal(anthropic([user("a"), { role: "assistant", content: [{ type: "text", text: "b" }] }, user("memory context"), user("question"), call, result]).turnStart, 2);
  assert.equal(anthropic([call, result]).turnStart, null);
  assert.deepEqual(anthropic([user("a"), call, result]).outline.map(({ kinds }) => kinds), [["text"], ["thinking", "tool_use"], ["tool_result"]]);
});

test("an outline names the cache marker wherever the provider put it", () => {
  const marked = { role: "user", content: [{ type: "text", text: "x", cache_control: { type: "ephemeral" } }] };
  const body = request([]);
  const capture = createPromptCapture();
  capture.observeRequest({ model: "m", messages: [{ role: "user", content: [{ type: "text", text: "plain" }] }, marked] }, model("anthropic-messages"));
  assert.deepEqual(pagePromptMessages(capture.body(), 0, 50).outline.map(({ cache }) => cache), [false, true]);
  assert.equal(pagePromptMessages(body, 0, 50).total, 0);
});

test("a listener hears every recorded request, after its record exists, until it unsubscribes", () => {
  const capture = createPromptCapture();
  const heard = [];
  const stop = capture.subscribe((requests) => heard.push([requests, capture.body()?.seq, capture.report().latest.repeats]));
  const ask = (text) => capture.observeRequest({ model: "m", messages: [{ role: "system", content: "S" }, { role: "user", content: text }] }, model("openai-completions"));
  ask("one"); ask("one"); ask("two");
  assert.deepEqual(heard, [[1, 1, 0], [2, 1, 1], [3, 3, 0]]);
  assert.equal(capture.requests(), 3);
  stop();
  ask("three");
  assert.equal(heard.length, 3);
});
