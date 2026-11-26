import { useEffect } from "react";
import { useEffectEvent } from "react";

// An open file menu or dialog (Mantine portals) takes the first Escape itself. Closed dialogs stay mounted, hidden.
const overlayOpen = () => [...document.querySelectorAll('[data-portal] [role="menu"], [data-portal] [role="dialog"]')].some((node) => node.checkVisibility({ visibilityProperty: true }));

const inside = (target: EventTarget | null, selector: string) => target instanceof Element && target.closest(selector) !== null;

/** While `active`: a press outside the tree popover or Escape calls `onDismiss`. Presses on the tree itself, on the
 * workspace's own controls (its strip with the tree toggle and new shell, and the control group) and inside Mantine
 * portals (file menu, dialogs) do not count: closing the tree of an empty workspace closes the workspace, so the pressed
 * control would be gone before its click lands; Escape does not either while such an overlay is
 * open or typed in the filter box (those close themselves first). */
export function useDismissOutside(active: boolean, onDismiss: () => void) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!active) return undefined;
    const onPointer = (event: PointerEvent) => { if (!inside(event.target, "#file-tree, .pi-stage-strip, #workspace-controls, [data-portal]")) dismiss(); };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing && event.keyCode !== 229 && !inside(event.target, "#files-filter") && !overlayOpen()) {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onPointer, true); window.removeEventListener("keydown", onKey, true); };
  }, [active]);
}
