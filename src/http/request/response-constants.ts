

// Responses are data or file attachments, never app documents: nothing here may
// be rendered, framed or cached. The browser UI's own policy belongs to
// whatever serves web/.
export const API_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
} as const;
