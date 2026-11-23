import "./memory-notice.css";
import NoteAccordion from "../../design-system/note-accordion/NoteAccordion.jsx";
import { Changes } from "./MemoryChanges.jsx";
export const targetNames = { control: "规矩", user: "用户", memory: "记忆", instance: "实例" };

export const actionNames = { add: "新增", replace: "修改", remove: "删除" };

export function MemoryNotice({ notice }) {
  const changes = notice.changes || [];
  const counts = new Map();
  for (const change of changes) {
    const operation = { add: "+", replace: "改", remove: "删" }[change.action];
    const key = `${targetNames[change.target]} ${operation}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const summary = `${notice.source === "control" ? "规矩" : "记忆"}已更新：${[...counts].map(([key, count]) => `${key}${count}`).join(" · ")}`;
  return <NoteAccordion className="pi-memory-notice" data-memory-notice={notice.source} data-count={changes.length} title={summary}>
    <Changes changes={changes} />
  </NoteAccordion>;
}
