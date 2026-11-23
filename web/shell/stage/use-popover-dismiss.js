import { useEffect } from "react";
import { useEffectEvent } from "react";

// An open file menu or dialog (Mantine portals) takes the first Escape itself. Closed dialogs stay mounted, hidden.
const overlayOpen = () => [...document.querySelectorAll('[data-portal] [role="menu"], [data-portal] [role="dialog"]')].some((node) => node.checkVisibility({ visibilityProperty: true }));

/** While `active`: a press outside the tree popover or Escape calls `onDismiss`. Presses on the tree itself, on its
 * toggle and inside Mantine portals (file menu, dialogs) do not count; Escape does not either while such an overlay is
 * open or typed in the filter box (those close themselves first). */
export function usePopoverDismiss(active, onDismiss) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!active) return undefined;
    const onPointer = (event) => { if (!event.target.closest?.("#file-tree, #toggle-tree, [data-portal]")) dismiss(); };
    const onKey = (event) => {
      if (event.key === "Escape" && !event.isComposing && event.keyCode !== 229 && !event.target.closest?.("#files-filter") && !overlayOpen()) {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onPointer, true); window.removeEventListener("keydown", onKey, true); };
  }, [active]);
}
