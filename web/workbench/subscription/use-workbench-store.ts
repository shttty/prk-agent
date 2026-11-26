import { useContext } from "react";
import type { WorkbenchStore } from "../store/assemble-workbench-store.ts";
import { WorkbenchContext } from "./workbench-context.ts";

/** The store itself, for an event handler or an effect that decides from the state at that moment instead of rendering from it. */
export function useWorkbenchStore(): WorkbenchStore {
  const store = useContext(WorkbenchContext);
  if (!store) throw new Error("useWorkbenchStore needs a WorkbenchContext provider.");
  return store;
}
