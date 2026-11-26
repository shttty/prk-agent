import { resolve } from "node:path";

/** The configured `session.soulFile` as an absolute path: relative paths resolve against the PRK home. */
export function soulPath(home: string, file: string): string {
  return resolve(home, file);
}
