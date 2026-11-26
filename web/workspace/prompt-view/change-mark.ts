import type { Delta } from "../../../src/gateway/wire/web-types.ts";

/** How one entry differs from the previous request: "新增", "已改 3,890→4,074", or null when it is the same. */
export function changeMark(delta: Delta | null | undefined, key: string): string | null {
  if (delta?.added.some((entry) => entry.key === key)) return "新增";
  const changed = delta?.changed.find((entry) => entry.key === key);
  return changed ? `已改 ${changed.before.toLocaleString()}→${changed.after.toLocaleString()}` : null;
}
