import type { ComponentProps, ReactNode } from "react";
import { ActionIcon } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";

type DetailHeaderProps = Omit<ComponentProps<"header">, "title"> & { title: ReactNode; meta?: ReactNode; onBack?: (() => void) | null; backAction?: string };

/**
 * Title line of a settings detail pane: back (phone sheet only), name, a grey count or summary, and the pane's own
 * controls on the right (group switch, settings button).
 */
export function DetailHeader({ title, meta, onBack, backAction, children, ...props }: DetailHeaderProps) {
  return <header className="settings-detail-head" {...props}>
    {onBack ? <ActionIcon data-action={backAction} variant="subtle" color="gray" aria-label="返回" onClick={onBack}><IconChevronLeft size={18} /></ActionIcon> : null}
    <div className="settings-detail-title">
      <h3 title={typeof title === "string" ? title : undefined}>{title}</h3>
      {meta ? <div className="settings-detail-meta">{meta}</div> : null}
    </div>
    {children ? <div className="settings-detail-actions">{children}</div> : null}
  </header>;
}
