export const supportedEvents = Object.freeze({
  session_start: true, session_info_changed: true, session_shutdown: true, session_before_switch: true,
  session_before_fork: true, session_before_compact: true, session_compact: true, session_compact_failed: true,
  session_before_tree: true, session_tree: true, tool_call: true, tool_result: true,
  context: true, context_with_system: true, before_provider_request: true, before_agent_start: true, agent_settled: true,
});
export const toolMetadataKeys = Object.freeze({
  name: true, label: true, description: true, promptSnippet: true, promptGuidelines: true,
  parameters: true, outputSchema: true, constrainedSampling: true, exposure: true,
  namespace: true, annotations: true, defaultActive: true, executionMode: true,
});
export const rendererKeys = Object.freeze({ renderCall: true, renderResult: true, renderShell: true });
export const schemaTypes = Object.freeze({ null: true, boolean: true, object: true, array: true, number: true, string: true, integer: true });
