import type { ManagedSessionSnapshot } from "../../src/gateway/wire/web-types.ts";
import type { StampedMonitor } from "../monitor/readings/monitor-types.ts";

/** A session as the workbench lists it: the Gateway's row with its monitor stamped on arrival. */
export type SessionRow = Omit<ManagedSessionSnapshot, "monitor"> & { readonly monitor?: StampedMonitor; /** Set by the workbench when a turn finished while the row was not selected. */ readonly done?: true };
export type SessionRows = ReadonlyMap<string, SessionRow>;

/** A session whose stored data cannot be read: diagnostics only, never a `SessionRow`. */
export type UnreadableIssue = {
  key: string;
  location: "active" | "archived" | "unknown";
  sessionId: string;
  sessionFile: string;
  reason: string;
  label: string;
  target: string;
  archived: { group: string; at: string; kernelOrphan: boolean } | null;
};
