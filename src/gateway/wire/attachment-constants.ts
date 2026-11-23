export const NATIVE_IMAGE_MIME_TYPES = Object.freeze(["image/png", "image/jpeg", "image/gif", "image/webp"] as const);
export const NATIVE_TEXT_MIME_TYPES = Object.freeze(["text/plain", "text/markdown", "text/csv", "text/x-python", "application/json", "application/javascript"] as const);
export const NATIVE_ATTACHMENT_MIME_TYPES = Object.freeze([...NATIVE_IMAGE_MIME_TYPES, ...NATIVE_TEXT_MIME_TYPES] as const);
