export function MonitorBlock({ name, label, open, toggle, children }) {
  return <details data-monitor-block={name} open={open}>
    <summary onClick={(event) => { event.preventDefault(); toggle(name); }}>{label}</summary>
    {open ? <div className="pi-monitor-block-content">{children}</div> : null}
  </details>;
}
