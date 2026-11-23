export function resolveDialog<T>(resolvePromise: (value: T | undefined) => void, value: unknown): void { resolvePromise(value as T | undefined); }
