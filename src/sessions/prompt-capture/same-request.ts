import type { RequestDigest } from "./capture-types.ts";

/** The same system, tools and messages: a replay of the previous request, not a new one. */
export function sameRequest(a: RequestDigest, b: RequestDigest): boolean {
  return a.system === b.system && JSON.stringify(a.tools) === JSON.stringify(b.tools) && JSON.stringify(a.messages) === JSON.stringify(b.messages);
}
