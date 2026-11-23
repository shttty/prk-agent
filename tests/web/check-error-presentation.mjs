import assert from "node:assert/strict";
import { describeSessionFailure } from "../../src/diagnostics/session-errors/describe-session-failure.ts";
import { summarizeSessionFailure } from "../../src/diagnostics/session-errors/summarize-session-failure.ts";

const providerFailure = {
  messages: [{
    role: "assistant",
    content: [],
    api: "openai-codex-responses",
    provider: "fixture-provider",
    model: "fixture-model",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "error",
    errorMessage: "WebSocket error",
    timestamp: 1,
    diagnostics: [{
      type: "provider_transport_failure",
      timestamp: 1,
      error: { name: "Error", message: "WebSocket error", stack: "Error: WebSocket error\n    at fixtureTransport" },
      details: { configuredTransport: "websocket", phase: "receive", requestBytes: 123 },
    }],
  }],
};

assert.match(summarizeSessionFailure(providerFailure, "Error: WebSocket error\n    at rejectedPrompt"), /WebSocket error/);
const detail = describeSessionFailure(providerFailure, "Error: WebSocket error\n    at rejectedPrompt");
assert.match(detail, /fixture-provider\/fixture-model/);
assert.match(detail, /provider_transport_failure/);
assert.match(summarizeSessionFailure(providerFailure, "Error: cancelled", 1), /Error: cancelled/);
assert.match(detail, /at fixtureTransport/);
assert.match(detail, /requestBytes/);

const apiMessage = "429 Too Many Requests: quota exhausted";
const apiFailure = { messages: [{ ...providerFailure.messages[0], errorMessage: apiMessage, diagnostics: [] }] };
assert.ok(summarizeSessionFailure(apiFailure, apiMessage).includes(apiMessage));
assert.match(summarizeSessionFailure({ messages: [] }, "Error: socket bind failed\n    at listen"), /Error: socket bind failed/);

console.log("PASS Web summary stays concise while Gateway diagnostics retain full captured detail");
