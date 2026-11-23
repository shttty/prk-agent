export function terminalSocketUrl(api, sessionId, name, generation) {
  const url = new URL(`${api.root}/sessions/${encodeURIComponent(sessionId)}/terminals/${encodeURIComponent(name)}/ws`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (generation) url.searchParams.set("generation", generation);
  return url;
}
