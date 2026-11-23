import { posix } from "node:path";
import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { readDerivedSession } from "./read-derived-session.ts";

export function readIsolationEnvironment(manager: SessionManager): Record<string, string> {
  const state = readDerivedSession(manager);
  return state?.isolated && state.worktreeRoot ? { GIT_CEILING_DIRECTORIES: posix.dirname(state.worktreeRoot) } : {};
}
