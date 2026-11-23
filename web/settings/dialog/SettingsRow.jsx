import { Badge } from "@mantine/core";
export function Row({ id, icon: Icon, title, fact, factProps, onClick }) {
  return <button type="button" id={id} className="pi-settings-row" onClick={onClick}>
    <span className="pi-settings-icon" aria-hidden="true"><Icon size={16} stroke={1.7} /></span>
    <span className="pi-settings-title">{title}</span>
    {fact ? <Badge component="span" variant="light" color="green" size="sm" tt="none" className="pi-settings-fact" {...factProps}>{fact}</Badge> : null}
  </button>;
}
