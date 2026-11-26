import { sessionStates } from "./session-instruments.ts";

/** The returned function unbinds, and only if no later host has replaced the source. */
export function bindSessionStates(read: () => Readonly<Record<string, number>>): () => void {
  sessionStates.read = read;
  return () => { if (sessionStates.read === read) sessionStates.read = undefined; };
}
