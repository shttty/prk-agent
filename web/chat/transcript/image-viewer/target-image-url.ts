import type { ChatActions } from "../../thread/chat-actions-types.ts";
export function targetImageUrl(api: ChatActions["api"], sessionId: string, target: string, path: string): string {
  const query = new URLSearchParams({ target, path });
  return `${api.root}/sessions/${encodeURIComponent(sessionId)}/files/image?${query}`;
}
