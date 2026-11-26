import { useContext } from "react";
import { WorkbenchContext } from "../workbench/subscription/workbench-context.js";
import type { WorkbenchReads } from "./workbench-reads-types.ts";

type WorkbenchStore = { getSnapshot: () => WorkbenchReads };

// The context is created untyped in JS; this is where the store gets its type.
function provided(store: WorkbenchStore | null): WorkbenchStore {
  if (!store) throw new Error("The workbench store comes from App; render this component under it.");
  return store;
}

/** Reads the workbench state at this moment, for an event handler or an initializer that decides from it rather than renders from it. */
export function useWorkbenchSnapshot(): () => WorkbenchReads {
  const store = provided(useContext(WorkbenchContext));
  return () => store.getSnapshot();
}
