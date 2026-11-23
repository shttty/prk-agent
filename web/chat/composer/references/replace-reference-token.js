
/** Replace the trailing `@token` with `replacement` (e.g. `@dir/` keeps browsing, `@file ` ends the token). */
export function replaceReferenceToken(value, replacement) {
  return value.replace(/(?:^|\s)@[^\s@]*$/, (prefix) => `${/^\s/.test(prefix) ? prefix[0] : ""}${replacement}`);
}
