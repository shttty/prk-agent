
export function requestId() {
  return globalThis.crypto?.randomUUID?.() || `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

