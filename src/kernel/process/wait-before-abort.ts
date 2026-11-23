export async function waitBeforeAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  const cancelled = Promise.withResolvers<never>();
  const abort = () => cancelled.reject(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  try { return await Promise.race([operation, cancelled.promise]); }
  finally { signal.removeEventListener("abort", abort); }
}
