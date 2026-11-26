/**
 * Phone detail slide-over of a settings list page (tools, Skills, memory): a scrim that closes it and the sheet
 * sliding in from the right. Callers portal it into the settings modal frame and put their own back control inside.
 */
export function DetailSheet({ open, onClose, closeAction, children, ...props }) {
  return <div className="capability-layer" data-open={String(open)}>
    <div className="capability-scrim" data-action={closeAction} onClick={onClose} />
    <aside className="capability-sheet" aria-hidden={!open} {...props}>{children}</aside>
  </div>;
}
