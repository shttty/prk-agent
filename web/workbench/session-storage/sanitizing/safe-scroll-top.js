
export function safeScrollTop(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

