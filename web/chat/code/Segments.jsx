
export function Segments({ segments, text }) {
  if (!segments?.length) return text;
  return segments.map(([part, cls], index) => (cls ? <span key={index} className={cls}>{part}</span> : part));
}
