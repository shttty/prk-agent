import type { createWorkbenchActions } from "../workbench/store/create-workbench-actions.js";

/** What the workbench store offers the UI; dialogs and panels call it by name. */
export type WorkbenchActions = ReturnType<typeof createWorkbenchActions>;
