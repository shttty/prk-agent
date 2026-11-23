import { useState } from "react";
/** Rows to show for a block of `count` rows folded at `limit`; `hidden` is how many are left behind. */
export function useFold(count, limit) {
  const [expanded, setExpanded] = useState(false);
  const hidden = expanded ? 0 : Math.max(0, count - limit);
  return { shown: hidden ? limit : count, hidden, expand: () => setExpanded(true) };
}
