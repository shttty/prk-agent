import type { CapabilityCtx, CapabilityEntry, RowHandlers } from "../capability-types.ts";

const rowOf = (node: Element) => node.closest(".capability-row");

export function rowHandlers(ctx: Pick<CapabilityCtx, "peekRef" | "timers" | "showPeek" | "scheduleHide" | "press" | "swallow" | "mobile">, entry: CapabilityEntry): RowHandlers {
  const { peekRef, timers, showPeek, scheduleHide, press, swallow, mobile } = ctx;
  return {
    onPointerEnter: (event) => {
      if (event.pointerType !== "mouse" || peekRef.current?.pinned) return;
      clearTimeout(timers.current.hide);
      if (peekRef.current?.entry.id === entry.id) return;
      clearTimeout(timers.current.hover);
      const row = rowOf(event.currentTarget);
      timers.current.hover = setTimeout(() => showPeek({ entry, row, mode: "hover" }), peekRef.current ? 60 : 300);
    },
    onPointerLeave: (event) => { if (event.pointerType === "mouse") { clearTimeout(timers.current.hover); scheduleHide(); } },
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return;
      const row = rowOf(event.currentTarget);
      const state: { x: number; y: number; fired: boolean; sticky: boolean; timer: ReturnType<typeof setTimeout> | undefined } = { x: event.clientX, y: event.clientY, fired: false, sticky: Boolean(entry.library), timer: undefined };
      state.timer = setTimeout(() => {
        state.fired = true; swallow.current = true;
        showPeek({ entry, row, mode: "touch", x: state.x, y: state.y, pinned: state.sticky });
        navigator.vibrate?.(8);
      }, 450);
      press.current = state;
    },
    // Saved-library entries carry actions (promote/archive/delete): a click pins their card until a click elsewhere.
    onClick: (event) => {
      if (!entry.library || (event.target instanceof Element && event.target.closest("[data-action]"))) return;
      clearTimeout(timers.current.hover); clearTimeout(timers.current.hide);
      const row = rowOf(event.currentTarget);
      const box = row?.getBoundingClientRect();
      if (!row || !box) return;
      showPeek({ entry, row, mode: mobile ? "touch" : "hover", x: box.left + box.width / 2, y: box.top + box.height / 2, pinned: true });
    },
    onContextMenu: (event) => event.preventDefault(),
  };
}
