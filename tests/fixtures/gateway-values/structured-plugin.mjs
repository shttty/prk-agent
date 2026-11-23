export default function register(pi) {
  for (const [name, value] of Object.entries({ object: { answer: 42 }, array: [1, 2], text: "native text", integer: 7, float: 1.25, boolean: false, null: null })) {
    pi.registerTool({ name: `value_${name}`, label: name, description: "Explicit structured plugin value without outputSchema", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "direct text is independent" }], structuredContent: value, details: undefined }) });
  }
  pi.registerTool({ name: "value_json_text", label: "JSON text", description: "Plugin text is not decoded", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: '{"answer":42}' }], details: { answer: "not the return value" } }) });
  pi.registerTool({ name: "value_error", label: "Error", description: "Failure carrying structured data", parameters: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "PLUGIN_VALUE_FAILURE" }], structuredContent: { error: "must not be returned" }, isError: true, details: undefined }) });
}
