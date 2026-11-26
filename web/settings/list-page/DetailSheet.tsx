import type { ComponentProps } from "react";

type DetailSheetProps = ComponentProps<"aside"> & { open: boolean; onClose: () => void; closeAction?: string };

/**
 * Phone detail slide-over of a settings list page (tools, Skills, memory): a scrim that closes it and the sheet
 * sliding in from the right. Callers portal it into the settings modal frame and put their own back control inside.
 */
export function DetailSheet({ open, onClose, closeAction, children, ...props }: DetailSheetProps) {
  return <div className="settings-sheet-layer" data-open={String(open)}>
    <div className="settings-sheet-scrim" data-action={closeAction} onClick={onClose} />
    <aside className="settings-sheet" aria-hidden={!open} {...props}>{children}</aside>
  </div>;
}
