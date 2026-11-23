import { IconArrowRight } from "@tabler/icons-react";

/** `<current holder> → <new holder>` of a role or a parent link, for confirmation dialogs; `from` null = nobody. */
export function HolderChange({ role, from, to }) {
  return <div className="management-holder-change" data-role={role}>
    <span className="management-holder" data-holder="from" data-session-id={from?.sessionId || undefined}>{from ? from.label : "无"}</span>
    <IconArrowRight size={16} stroke={1.8} aria-hidden="true" />
    <span className="management-holder" data-holder="to" data-session-id={to?.sessionId || undefined}>{to?.label || "—"}</span>
  </div>;
}
