
// Browser file → wire attachment, and the limits a list of them must stay within (the composer's; the limits come from
// the native catalog, `nativeCatalog.attachments`).
export const MAX_ATTACHMENTS = 4;

export const MAX_ATTACHMENT_BYTES = 384 * 1024;

export const MAX_TOTAL_ATTACHMENT_BYTES = 640 * 1024;

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export const FALLBACK_MIME_TYPES = [...IMAGE_MIME_TYPES, "text/plain", "text/markdown", "text/csv", "application/json"];
