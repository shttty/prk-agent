import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { resolve } from "node:path";
import { invalid } from "../reject-invalid-history.ts";

export function sessionFile(manager: SessionManager, expected: string): string {
  const file = manager.getSessionFile();
  if (typeof file !== "string" || resolve(file) !== resolve(expected)) invalid("session file");
  return file;
}
