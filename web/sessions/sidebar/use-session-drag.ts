import { useState, type DragEvent } from "react";
import type { SessionRow, SessionRows } from "../../workbench/store/store-types.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { canDropSessionToGroup } from "./grouping/can-drop-session-to-group.ts";
import { projectPayloadForGroup } from "./grouping/project-payload-for-group.ts";
import type { SessionDrag, SessionGroup } from "./sidebar-types.ts";

type DropTarget = Pick<SessionGroup, "id" | "name">;

/** Dragging a session row onto a project heading (or the ungrouped zone) assigns it there. */
export function useSessionDrag(actions: WorkbenchActions, sessions: SessionRows) {
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);
  const draggedSession = draggedSessionId ? sessions.get(draggedSessionId) ?? null : null;
  const clear = () => { setDraggedSessionId(null); setDropGroupId(null); };
  const drag: SessionDrag = {
    draggedSessionId,
    onStart: (sessionRow: SessionRow) => { setDraggedSessionId(sessionRow.sessionId); setDropGroupId(null); },
    onEnd: clear,
  };
  const finishDrop = (group: DropTarget, event: DragEvent) => {
    event.preventDefault();
    const id = draggedSessionId || event.dataTransfer.getData("application/x-prk-session") || event.dataTransfer.getData("text/plain");
    const source = id ? sessions.get(id) : undefined;
    const payload = projectPayloadForGroup(group);
    clear();
    if (!source || payload === undefined || !canDropSessionToGroup(source, group)) return;
    void actions.assignProject(payload, source.sessionId);
  };
  /** The drag-over, leave and drop handlers of a group that accepts drops (none when `enabled` is false). */
  const dropProps = (group: DropTarget, enabled: boolean) => enabled ? {
    onDragOver: (event: DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dropGroupId !== group.id) setDropGroupId(group.id); },
    onDragLeave: (event: DragEvent<HTMLElement>) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropGroupId((current) => (current === group.id ? null : current)); },
    onDrop: (event: DragEvent) => finishDrop(group, event),
  } : {};
  return { draggedSession, dropGroupId, drag, dropProps };
}
