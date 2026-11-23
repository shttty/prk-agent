export function callbackReplyChunk(cellId: string, requestId: unknown, data: string, final: boolean) {
  return { kind: "callback_reply_chunk" as const, cellId, requestId, data, final };
}
