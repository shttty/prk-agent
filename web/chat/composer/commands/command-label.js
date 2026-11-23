
export function commandLabel(candidate) {
  return `${candidate.prefix || "/"}${candidate.name}`;
}
