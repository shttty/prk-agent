export function replaceViewQuery(name: string | null) {
  try {
    if (!globalThis.history?.replaceState || !globalThis.location) return;
    const url = new URL(globalThis.location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    if (name) params.set("sessionId", name);
    else params.delete("sessionId");
    url.hash = params.toString();
    globalThis.history.replaceState(globalThis.history.state, "", url);
  } catch { /* an unusable address bar only loses the shareable link */ }
}
