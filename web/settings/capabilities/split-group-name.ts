
import type { CapabilityGroup } from "./capability-types.ts";

// Group labels: dynamic skill-directory groups cut the path in the middle (ellipsis between its start and the
// directory that holds `.agents/skills`); any other label with " · " cuts its head and keeps the last segment (machine
// or path) whole. Labels without " · " stay plain text. textContent always equals the backend label.
export const SEPARATOR = " · ";

export type GroupNameParts = [string, string | null, string];

export function splitGroupName(item: CapabilityGroup): GroupNameParts | null {
  const { path } = item;
  if (path && item.name.startsWith(`${path}${SEPARATOR}`)) {
    const marker = path.lastIndexOf("/.agents/skills");
    const split = marker < 0 ? 0 : path.lastIndexOf("/", marker - 1) + 1;
    return [path.slice(0, split), path.slice(split), item.name.slice(path.length)];
  }
  const cut = item.name.lastIndexOf(SEPARATOR);
  return cut < 0 ? null : [item.name.slice(0, cut), null, item.name.slice(cut)];
}
