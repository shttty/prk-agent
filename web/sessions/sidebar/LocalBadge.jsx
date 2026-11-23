import { Badge } from "@mantine/core";
// Marks the instance that runs on the Gateway host (config `local: true`).
export function LocalBadge() {
  return <Badge component="span" variant="light" size="xs" tt="none" radius="sm" className="management-local-badge" data-local="true">local</Badge>;
}
