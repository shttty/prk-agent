import type { PageApi } from "../../shell/page/page-types.ts";

type Interrupt = { name: string; generation: string; commandId: string };

export function interruptTerminal(api: PageApi, sessionId: string, { name, generation, commandId }: Interrupt, isCurrent: () => boolean, onError: () => void) {
  if (!isCurrent()) return;
  void api.post(`/sessions/${encodeURIComponent(sessionId)}/terminals/interrupt`, { name, generation, commandId })
    .catch(() => { if (isCurrent()) onError(); });
}
