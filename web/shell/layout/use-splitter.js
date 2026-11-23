import "./splitter.css";
import { useRef } from "react";
export function useSplitter(axis, size, setSize, commit, clamp, { invert = false } = {}) {
  const sign = invert ? -1 : 1;
  const drag = useRef(null);
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
    drag.current = { start: axis === "x" ? event.clientX : event.clientY, size };
  };
  const onPointerMove = (event) => {
    if (!drag.current) return;
    const delta = sign * (drag.current.start - (axis === "x" ? event.clientX : event.clientY));
    setSize(clamp(drag.current.size + delta));
  };
  const onPointerUp = (event) => {
    delete event.currentTarget.dataset.dragging;
    if (!drag.current) return;
    const delta = sign * (drag.current.start - (axis === "x" ? event.clientX : event.clientY));
    commit(drag.current.size + delta);
    drag.current = null;
  };
  const onKeyDown = (event) => {
    const step = event.shiftKey ? 64 : 16;
    const grow = axis === "x" ? { ArrowLeft: step, ArrowRight: -step } : { ArrowUp: step, ArrowDown: -step };
    if (grow[event.key] === undefined) return;
    event.preventDefault();
    commit(size + sign * grow[event.key]);
  };
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown, tabIndex: 0, role: "separator", "aria-orientation": axis === "x" ? "vertical" : "horizontal", "aria-valuenow": size };
}

