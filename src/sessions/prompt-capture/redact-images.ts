import { createHash } from "node:crypto";

const DATA_URL = /^data:([^;,]+);base64,/u;

/**
 * A copy of a provider payload for display. Base64 media (images, documents) is never kept: each such value becomes
 * `{mime, bytes, sha256}` with the first 12 hex digits of the SHA-256 of the decoded bytes. Everything else is copied as is.
 */
export function redactImages(value: unknown, mime?: string): unknown {
  if (typeof value === "string") {
    const url = DATA_URL.exec(value);
    return url ? placeholder(url[1]!, Buffer.from(value.slice(url[0].length), "base64")) : value;
  }
  if (value instanceof Uint8Array) return placeholder(mime ?? "application/octet-stream", value);
  if (Array.isArray(value)) return value.map((item) => redactImages(item, mime));
  if (typeof value !== "object" || value === null) return value;
  const fields = value as Record<string, unknown>;
  const here = typeof fields.media_type === "string" ? fields.media_type : typeof fields.mimeType === "string" ? fields.mimeType
    : typeof fields.format === "string" ? `image/${fields.format}` : mime;
  const inline = typeof fields.media_type === "string" || typeof fields.mimeType === "string";
  return Object.fromEntries(Object.entries(fields).map(([key, item]) => [key,
    inline && key === "data" && typeof item === "string" ? placeholder(here!, Buffer.from(item, "base64")) : redactImages(item, here)]));
}

function placeholder(mime: string, bytes: Uint8Array): { mime: string; bytes: number; sha256: string } {
  return { mime, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex").slice(0, 12) };
}
