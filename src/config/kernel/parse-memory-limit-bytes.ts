/** Deliberately finite byte limits: no percentages, infinity, or implicit unit conversion. */
export function memoryLimitBytes(value: unknown, allowZero = false): number {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)([KMGTPE])?$/u.test(value)) {
    throw new Error("Memory limit must be a decimal byte string with an optional binary K/M/G/T/P/E suffix.");
  }
  const match = /^(\d+)([KMGTPE])?$/u.exec(value)!;
  const bytes = Number(match[1]) * 1024 ** (match[2] ? "KMGTPE".indexOf(match[2]) + 1 : 0);
  if (!Number.isSafeInteger(bytes) || bytes < (allowZero ? 0 : 1)) throw new Error("Memory limit must be a finite safe byte count.");
  return bytes;
}
