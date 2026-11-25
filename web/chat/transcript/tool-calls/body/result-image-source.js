// Kernel and Gateway normalize results to these four; anything else stays text-only.
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function resultImageSource(part) {
  if (part?.type === "image" && IMAGE_MIME_TYPES.has(part.mimeType) && typeof part.data === "string" && part.data) {
    return `data:${part.mimeType};base64,${part.data}`;
  }
}
