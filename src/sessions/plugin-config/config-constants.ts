export const MASK = "••••••";
export const SECRET_NAME = /key|token|secret|password/i;
// Array, not an object literal: `{ __proto__: … }` would set the prototype instead of a key.
export const FORBIDDEN = ["__proto__", "prototype", "constructor"];
