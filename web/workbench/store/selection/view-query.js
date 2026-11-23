
export function viewQuery(ctx) {
    try {
      const url = new URL(globalThis.location?.href || "http://localhost/");
      const params = new URLSearchParams(url.hash.slice(1));
      const sessionId = params.get("sessionId")?.trim() || "";
      return sessionId ? { sessionId } : null;
    } catch {
      return null;
    }
  }

