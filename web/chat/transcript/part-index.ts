import type { useAui } from "@assistant-ui/react";

/** Position of the message part being rendered, or undefined when the part is addressed some other way. */
export function partIndex(aui: ReturnType<typeof useAui>): number | undefined {
  const query = aui.part.query;
  return query && "index" in query ? query.index : undefined;
}
