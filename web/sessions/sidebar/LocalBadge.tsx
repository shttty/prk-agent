import { Badge, type BadgeProps } from "@mantine/core";

// Marks the instance that runs on the Gateway host (config `local: true`).
export function LocalBadge(props: BadgeProps) {
  return <Badge component="span" variant="light" size="xs" tt="none" radius="sm" className="management-local-badge" data-local="true" {...props}>local</Badge>;
}
