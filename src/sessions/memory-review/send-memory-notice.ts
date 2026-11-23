import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { MemoryChange } from "../memory/memory-types.ts";

export async function sendMemoryNotice(session: AgentSession, details: {
  readonly source: "review" | "control";
  readonly changes: readonly MemoryChange[];
}): Promise<void> {
  const counts = new Map<string, number>();
  for (const change of details.changes) {
    const key = `${change.target} ${change.action}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  await session.sendCustomMessage({
    customType: "memory-notice", display: true,
    content: `Memory updated: ${[...counts].map(([key, count]) => `${key} ${count}`).join("; ")}.`,
    details,
  }, { triggerTurn: false });
}
