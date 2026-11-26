import type { Segment } from "./code-types.ts";

export function Segments({ segments, text }: { segments?: Segment[] | null; text: string }) {
  if (!segments?.length) return text;
  return segments.map(([part, cls], index) => (cls ? <span key={index} className={cls}>{part}</span> : part));
}
