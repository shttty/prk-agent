import { Button } from "@mantine/core";

/** The last block of a detail pane: one destructive action behind an outlined red button; the caller confirms. */
export function DangerZone({ label, description, action, onAction, disabled, ...props }) {
  return <section className="settings-danger" {...props}>
    <div className="settings-danger-copy"><strong>{label}</strong>{description ? <span>{description}</span> : null}</div>
    <Button variant="outline" color="red" size="xs" disabled={disabled} onClick={onAction} data-action={action}>{label}</Button>
  </section>;
}
