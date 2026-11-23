
export function makeAssistantMessage(parts, id, createdAt, status = { type: "complete", reason: "stop" }, custom = {}) {
  return {
    id,
    role: "assistant",
    content: parts.length ? parts : [{ type: "text", text: "" }],
    createdAt,
    status,
    metadata: {
      unstable_state: undefined,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom,
    },
  };
}
