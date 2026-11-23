export function integer(value, source) {
  if (typeof value !== "string" || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`Remote host memory telemetry requires a nonnegative safe integer: ${source}`);
  }
  return Number(value);
}
