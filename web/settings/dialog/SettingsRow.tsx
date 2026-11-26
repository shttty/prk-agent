import type { ComponentProps, ReactNode } from "react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { Badge } from "@mantine/core";

type RowProps = { id: string; icon: TablerIcon; title: string; fact: ReactNode; factProps: ComponentProps<typeof Badge<"span">> & Record<`data-${string}`, string>; onClick: () => void };
export function Row({ id, icon: Icon, title, fact, factProps, onClick }: RowProps) {
  return <button type="button" id={id} className="pi-settings-row" onClick={onClick}>
    <span className="pi-settings-icon" aria-hidden="true"><Icon size={16} stroke={1.7} /></span>
    <span className="pi-settings-title">{title}</span>
    {fact ? <Badge component="span" variant="light" color="green" size="sm" tt="none" className="pi-settings-fact" {...factProps}>{fact}</Badge> : null}
  </button>;
}
