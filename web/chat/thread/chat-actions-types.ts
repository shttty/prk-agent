import type { createWorkbenchActions } from "../../workbench/store/create-workbench-actions.js";

/** The workbench actions every chat component receives as `actions`. */
export type ChatActions = ReturnType<typeof createWorkbenchActions>;
