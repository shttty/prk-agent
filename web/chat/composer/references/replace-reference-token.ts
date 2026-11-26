
/** Replace the trailing `@token` with `replacement` (e.g. `@dir/` keeps browsing, `@file ` ends the token). */
export function replaceReferenceToken(value: string, replacement: string): string {
  return value.replace(/(?:^|\s)@[^\s@]*$/, (prefix: string) => `${/^\s/.test(prefix) ? prefix[0] : ""}${replacement}`);
}
