export function sizeCallbackChunk(chunkBytes: number, maxFrameBytes: number): number {
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || !Number.isSafeInteger(maxFrameBytes) || maxFrameBytes < 8) {
    throw Object.assign(new Error("Invalid kernel callback chunk budget: chunkBytes must be a positive safe integer and processWindow.maxFrameBytes must be a safe integer of at least 8."), { code: "INVALID_REQUEST" });
  }
  return Math.min(chunkBytes, Math.floor(maxFrameBytes / 8));
}
