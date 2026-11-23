export function interruptTerminal(api, sessionId, { name, generation, commandId }, isCurrent, onError) {
  if (!isCurrent()) return;
  void api.post(`/sessions/${encodeURIComponent(sessionId)}/terminals/interrupt`, { name, generation, commandId })
    .catch(() => { if (isCurrent()) onError(); });
}
