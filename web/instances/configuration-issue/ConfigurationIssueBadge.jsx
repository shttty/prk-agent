import { Badge } from "@mantine/core";
import { issueLabel } from "./issue-label.js";
/** Marks an instance that still needs its connection command or Python; with `onOpen` it is the way to fill them in. */
export function ConfigurationIssueBadge({ issue, onOpen }) {
  if (!issue) return null;
  const label = issueLabel(issue);
  return <Badge component={onOpen ? "button" : "span"} type={onOpen ? "button" : undefined} onClick={onOpen} variant="light" color="yellow" size="xs" tt="none" radius="sm"
    className="management-configuration-issue" data-configuration-issue={issue.code} title={onOpen ? `${label}，打开实例设置` : label} style={onOpen ? { cursor: "pointer" } : undefined}>{label}</Badge>;
}
