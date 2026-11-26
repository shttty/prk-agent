import type { SessionHostSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { ToolRun } from "../../payloads/tool-runs/tool-run-types.ts";
import { historicalToolRuns } from "../../payloads/tool-runs/historical-tool-runs.ts";

/** Tool runs rebuilt from the snapshot's messages, with the live runs of the same calls (or of the running operation) kept over them. */
export function reconcileHistoryToolRuns(snapshot: Pick<SessionHostSnapshot, "messages" | "operation">, previousRuns: ReadonlyMap<string, ToolRun>, sessionId: string | null): Map<string, ToolRun> {
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
