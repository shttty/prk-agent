import { historicalToolRuns } from "../../payloads/tool-runs/historical-tool-runs.js";
export function reconcileHistoryToolRuns(snapshot, previousRuns, sessionId) {
  const runs = historicalToolRuns(snapshot.messages, sessionId || "session");
  for (const [key, run] of previousRuns) {
    const saved = runs.get(key);
    if (saved) runs.set(key, saved.ended
      ? { ...run, ...saved, operationId: run.operationId, startedAt: run.startedAt, endedAt: run.endedAt }
      : { ...saved, ...run });
    else if (snapshot.operation?.operationId && run.operationId === snapshot.operation.operationId) runs.set(key, run);
  }
  return runs;
}
