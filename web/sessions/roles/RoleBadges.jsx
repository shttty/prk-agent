import "./roles.css";
import { Badge } from "@mantine/core";

/** `root` / `supervisor` marks, shown in English as named (not translated). */
export function RoleBadges({ root, supervisor }) {
  if (!root && !supervisor) return null;
  return <span className="pi-role-badges">
    {root ? <Badge component="span" size="xs" radius="sm" tt="none" variant="light" className="pi-role-badge" data-role="root">root</Badge> : null}
    {supervisor ? <Badge component="span" size="xs" radius="sm" tt="none" variant="outline" color="gray" className="pi-role-badge" data-role="supervisor">supervisor</Badge> : null}
  </span>;
}
