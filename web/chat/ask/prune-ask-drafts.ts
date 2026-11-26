import { saved } from "./ask-draft-memory.ts";
/** Forget the drafts of `session`'s asks that are no longer waiting (answered, timed out, stopped). */
export function pruneAskDrafts(session: string, liveIds: readonly string[]) {
  for (const key of [...saved.keys()]) if (key.startsWith(`${session}:`) && !liveIds.includes(key.slice(session.length + 1))) saved.delete(key);
}
