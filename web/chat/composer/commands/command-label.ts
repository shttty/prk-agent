
export function commandLabel(candidate: { name: string; prefix?: string }) {
  return `${candidate.prefix || "/"}${candidate.name}`;
}
