
export function makeTextMessage(text, id, createdAt, role, custom = {}) {
  return {
    id,
    role,
    content: [{ type: "text", text }],
    createdAt,
    metadata: { custom },
  };
}
