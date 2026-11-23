import { visitEncodedValue } from "./visit-encoded-value.mjs";

// Transport values remain tagged, including objects: user keys cannot collide.
export function encode(value) {
  const ancestors = new Set();
  return visitEncodedValue(ancestors, value);
}
