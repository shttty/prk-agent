

export function modelParts(spec: string): { provider: string; id: string } {
  const separator = spec.indexOf("/");
  if (separator <= 0 || separator === spec.length - 1) throw new Error("model must use PROVIDER/MODEL format.");
  return { provider: spec.slice(0, separator), id: spec.slice(separator + 1) };
}
