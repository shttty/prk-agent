// Node/SDK session UUIDs use the canonical 8-4-4-4-12 spelling.
const UUID_CHARS = 36;
export const MIN_GENERATED_ID_CHARS = {
  // gateway-host projectTool generates `project-${uuid}`, longer than session UUIDs.
  identityChars: "project-".length + UUID_CHARS,
  // derived-session transfer notices use `derived-transfer:${childUuid}:${uuid}`.
  // This exceeds bare UUID, agent-message, derived-task and derived-result IDs.
  requestIdChars: "derived-transfer:".length + UUID_CHARS + ":".length + UUID_CHARS,
  // session-host operations combine `${sdkSessionUuid}:${uuid}`.
  operationIdChars: UUID_CHARS + ":".length + UUID_CHARS,
};
