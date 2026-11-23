
export function showPeek(ctx, next) {
  const { setPeek, setPeekOpen } = ctx;
  setPeek(next); setPeekOpen(true);
}

export function scheduleHide(ctx) {
  const { timers, peekRef, hidePeek } = ctx;
  clearTimeout(timers.current.hide); if (!peekRef.current?.pinned) timers.current.hide = setTimeout(hidePeek, 140);
}

export function rowHandlers(ctx, entry) {
  const { peekRef, timers, showPeek, scheduleHide, press, swallow, mobile } = ctx;
  return ({
    onPointerEnter: (event) => {
      if (event.pointerType !== "mouse" || peekRef.current?.pinned) return;
      clearTimeout(timers.current.hide);
      if (peekRef.current?.entry.id === entry.id) return;
      clearTimeout(timers.current.hover);
      const row = event.currentTarget.closest(".capability-row");
      timers.current.hover = setTimeout(() => showPeek({ entry, row, mode: "hover" }), peekRef.current ? 60 : 300);
    },
    onPointerLeave: (event) => { if (event.pointerType === "mouse") { clearTimeout(timers.current.hover); scheduleHide(); } },
    onPointerDown: (event) => {
      if (event.pointerType === "mouse") return;
      const row = event.currentTarget.closest(".capability-row");
      const state = { x: event.clientX, y: event.clientY, fired: false, sticky: Boolean(entry.library) };
      state.timer = setTimeout(() => {
        state.fired = true; swallow.current = true;
        showPeek({ entry, row, mode: "touch", x: state.x, y: state.y, pinned: state.sticky });
        navigator.vibrate?.(8);
      }, 450);
      press.current = state;
    },
    // Saved-library entries carry actions (promote/archive/delete): a click pins their card until a click elsewhere.
    onClick: (event) => {
      if (!entry.library || event.target.closest("[data-action]")) return;
      clearTimeout(timers.current.hover); clearTimeout(timers.current.hide);
      const row = event.currentTarget.closest(".capability-row"), box = row.getBoundingClientRect();
      showPeek({ entry, row, mode: mobile ? "touch" : "hover", x: box.left + box.width / 2, y: box.top + box.height / 2, pinned: true });
    },
    onContextMenu: (event) => event.preventDefault(),
  });
}
