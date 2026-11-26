import "./memory-notice.css";
import NoteAccordion from "../../design-system/note-accordion/NoteAccordion.tsx";
import type { MemoryChange } from "../../../src/gateway/wire/web-types.ts";
import { Changes } from "./MemoryChanges.tsx";
import { actionMarks, targetNames } from "./memory-notice-constants.ts";

export type MemoryNoticeDetails = { source: string; changes?: readonly MemoryChange[] };

export function MemoryNotice({ notice }: { notice: MemoryNoticeDetails }) {
  const changes = notice.changes || [];
  const counts = new Map<string, number>();
  for (const change of changes) {
    const key = `${targetNames[change.target]} ${actionMarks[change.action]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const summary = `${notice.source === "control" ? "规矩" : "记忆"}已更新：${[...counts].map(([key, count]) => `${key}${count}`).join(" · ")}`;
  return <NoteAccordion data-memory-notice={notice.source} data-count={changes.length} title={summary}>
    <Changes changes={changes} />
  </NoteAccordion>;
}
