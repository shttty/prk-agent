import assert from "node:assert/strict";

export function readRenderedRequest(capture) {
  assert(capture?.payload, "before_provider_request must capture the actual serialized provider request");
  const { payload } = capture;
  assert(Array.isArray(payload.input), "Use Pi's unmodified openai-responses input, not an invented instructions field");
  const messages = payload.input.filter((message) => message.role === "system" || message.role === "developer");
  assert.equal(messages.length, 1, "The default Responses serializer must supply one complete current system instruction checkpoint");
  assert.equal(typeof messages[0].content, "string", "Read serialized instruction content verbatim; never render SDK context ourselves");
  return { ...capture, instructions: messages[0].content, tools: payload.tools ?? [] };
}
