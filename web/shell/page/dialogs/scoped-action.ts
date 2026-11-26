/** `action`, unless `allowed()` is false when it is called: then it resolves false without running. */
export function scopedAction<Args extends unknown[]>(action: (...args: Args) => Promise<boolean>, allowed: () => boolean) {
  return async (...args: Args): Promise<boolean> => allowed() && await action(...args);
}
