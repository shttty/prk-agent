import type { PageApi } from "../../shell/page/page-types.ts";

export function terminalSocketUrl(api: PageApi, sessionId: string, name: string, generation: string | null) {
  const url = new URL(`${api.root}/sessions/${encodeURIComponent(sessionId)}/terminals/${encodeURIComponent(name)}/ws`, window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (generation) url.searchParams.set("generation", generation);
  return url;
}
