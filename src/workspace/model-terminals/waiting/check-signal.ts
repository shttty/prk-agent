
export function checkSignal(signal?: AbortSignal): void { if (signal?.aborted) throw signal.reason ?? new Error("Terminal call aborted."); }
