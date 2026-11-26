import { createContext } from "react";
import type { WorkbenchStore } from "../store/assemble-workbench-store.ts";

// The workbench store (`createWorkbenchStore()`), provided once by App; components subscribe through useWorkbench.
export const WorkbenchContext = createContext<WorkbenchStore | null>(null);
