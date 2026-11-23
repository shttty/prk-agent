import { visitDecodedValue } from "./visit-decoded-value.mjs";

export function decode(value) {
  const ancestors = new Set();
  return visitDecodedValue(ancestors, value);
}
