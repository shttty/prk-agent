import type { DragEvent } from "react";
import type { SessionRow } from "../session-row-types.ts";
import type { SessionDrag } from "./sidebar-types.ts";

/** The row's drag start/end handlers; undefined when dragging is off (not the project view, or a project change is in flight). */
export function sessionDragHandlers(sessionRow: SessionRow, drag: SessionDrag | null, enabled: boolean) {
  if (!enabled || !drag) return { onDragStart: undefined, onDragEnd: undefined };
  return {
    onDragStart: (event: DragEvent) => {
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-prk-session", sessionRow.sessionId);
      event.dataTransfer.setData("text/plain", sessionRow.sessionId);
      drag.onStart(sessionRow);
    },
    onDragEnd: (event: DragEvent) => {
      event.stopPropagation();
      drag.onEnd();
    },
  };
}
