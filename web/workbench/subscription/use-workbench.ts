import { useContext, useSyncExternalStore } from "react";
import type { WorkbenchState } from "../store/store-types.ts";
import { WorkbenchContext } from "./workbench-context.ts";

/**
 * Subscribes a component to one value of the workbench state: it re-renders only when `select(state)` changes by
 * `Object.is`. A selector returns a primitive or a reference that already lives in the state (`s.session.streams`,
 * `s.sessions.get(id)`), never a new object or array: React compares the result of every store notification, so a
 * fresh object would re-render (and warn) on each one. Derive objects in the component (useMemo over selected
 * references), or select several values with several calls. Helpers that take the whole state are fine inside a
 * selector as long as they return a primitive (`useWorkbench(isBusy)`).
 */
export function useWorkbench<Selected>(select: (state: WorkbenchState) => Selected): Selected {
  const store = useContext(WorkbenchContext);
  if (!store) throw new Error("useWorkbench needs a WorkbenchContext provider.");
  return useSyncExternalStore(store.subscribe, () => select(store.getSnapshot()));
}
