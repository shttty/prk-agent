export function targetImageUrl(api, sessionId, target, path) {
  const query = new URLSearchParams({ target, path });
  return `${api.root}/sessions/${encodeURIComponent(sessionId)}/files/image?${query}`;
}
