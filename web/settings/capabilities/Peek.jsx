import { useRef } from "react";
import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";
// Tool detail card: desktop hover (only inside the right block, never over the provider list), phone long press
// (above the finger, below when there is no room, never off the sides). Lives in the dialog frame, positioned in it.
export function Peek({ peek, open, frame, onPointerEnter, onPointerLeave, children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card || !frame || !peek) return;
    const box = frame.getBoundingClientRect();
    const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
    if (peek.mode === "touch") {
      card.style.maxWidth = ""; card.style.maxHeight = "";
      const width = card.offsetWidth, height = card.offsetHeight, x = peek.x - box.left, y = peek.y - box.top, finger = 44;
      const left = clamp(x - width / 2, 8, box.width - width - 8);
      const top = y - finger - height >= 8 ? y - finger - height : y + finger + height <= box.height - 8 ? y + finger : Math.max(8, box.height - 8 - height);
      Object.assign(card.style, { left: `${left}px`, top: `${top}px`, transformOrigin: `${x - left}px ${top < y ? "bottom" : "top"}` });
    } else {
      // Inside the right block on both axes: never over the provider list or the window header.
      const column = (peek.row.closest(".settings-detail-host") ?? frame).getBoundingClientRect();
      card.style.maxWidth = `${Math.max(240, column.width - 32)}px`;
      card.style.maxHeight = `${Math.max(160, column.height - 16)}px`;
      const width = card.offsetWidth, height = card.offsetHeight, row = peek.row.getBoundingClientRect();
      const below = row.bottom + 6 + height <= column.bottom - 8;
      Object.assign(card.style, {
        left: `${Math.max(column.left + 16, column.right - 16 - width) - box.left}px`,
        top: `${(below ? row.bottom + 6 : Math.max(column.top + 8, row.top - 6 - height)) - box.top}px`,
        transformOrigin: below ? "top right" : "bottom right",
      });
    }
  }, [peek, frame]);
  if (!frame || !peek) return null;
  return createPortal(<div ref={ref} id="capability-peek" className="capability-peek" role="tooltip" data-mode={peek.mode} data-open={String(open)} data-capability={peek.entry.id} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>{children}</div>, frame);
}
