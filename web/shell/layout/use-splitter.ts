import type { KeyboardEvent, PointerEvent } from "react";
import "./splitter.css";
import { useRef } from "react";

type Axis = "x" | "y";

/** Pointer and keyboard handlers for a resize handle (a drag handle is one of the documented positioned exceptions):
 * `size` is the current length, `setSize` follows the drag, `commit` saves the final value, `clamp` bounds it. */
export function useSplitter(axis: Axis, size: number, setSize: (value: number) => void, commit: (value: number) => void, clamp: (value: number) => number, { invert = false } = {}) {
  const sign = invert ? -1 : 1;
  const drag = useRef<{ start: number; size: number } | null>(null);
  const position = (event: PointerEvent) => (axis === "x" ? event.clientX : event.clientY);
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
    drag.current = { start: position(event), size };
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    setSize(clamp(drag.current.size + sign * (drag.current.start - position(event))));
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    delete event.currentTarget.dataset.dragging;
    if (!drag.current) return;
    commit(drag.current.size + sign * (drag.current.start - position(event)));
    drag.current = null;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 64 : 16;
    const grow: Record<string, number> = axis === "x" ? { ArrowLeft: step, ArrowRight: -step } : { ArrowUp: step, ArrowDown: -step };
    const change = grow[event.key];
    if (change === undefined) return;
    event.preventDefault();
    commit(size + sign * change);
  };
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown, tabIndex: 0, role: "separator", "aria-orientation": axis === "x" ? "vertical" as const : "horizontal" as const, "aria-valuenow": size };
}
