export const probeContract = {
  description: "Inspect a cobalt acceptance payload. Preserve this complete second sentence in search results.",
  snippet: "Inspect the cobalt payload.",
  guidelines: ["TOOL_SEARCH_GUIDELINE_7042: preserve the supplied payload exactly."],
  parameters: {
    type: "object",
    properties: { value: { type: "string" }, behavior: { type: "string" } },
    required: ["value"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object", properties: { value: { type: "string" } }, required: ["value"], additionalProperties: false,
  },
  failure: {
    content: [{ type: "text", text: "RESULT_HOOK_FAILURE_7042\nExact second line." }],
    details: { source: "result-hook", retained: [7042, false] },
    structuredContent: { value: "result-hook-failure" },
    isError: true,
  },
};
