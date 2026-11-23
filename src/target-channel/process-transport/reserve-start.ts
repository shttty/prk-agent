import type { Connection } from "@earendil-works/pi-env";
import { createProcessWindow } from "../../target-environment/process-window/assemble-window.ts";
import type { ProcessWindow, ProcessWindowLimits } from "../../target-environment/process-window/window-state.ts";

const starts = new WeakMap<Connection, { window: ProcessWindow; nextId: number }>();

/** Abandoned public SDK opens retain admission until their native promise actually settles. */
export function reserveStart(connection: Connection, cwd: string, argv: readonly string[], limits: ProcessWindowLimits): () => void {
  let entry = starts.get(connection);
  if (!entry) {
    entry = { window: createProcessWindow(limits), nextId: 0 };
    starts.set(connection, entry);
  }
  const id = ++entry.nextId;
  entry.window.reserve(id, Buffer.byteLength(JSON.stringify({ cwd, argv, op: "process" })));
  const window = entry.window;
  return () => window.confirm(id);
}
