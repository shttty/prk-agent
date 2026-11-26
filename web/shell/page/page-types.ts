import type { createWorkbenchStore } from "../../workbench/store/assemble-workbench-store.js";
import type { createWorkbenchActions } from "../../workbench/store/create-workbench-actions.js";

import type { CSSProperties, RefObject } from "react";

/** Inline style that may also set CSS custom properties (values the stylesheet reads: card gap, widths taken from saved layout). */
export type CssVars = CSSProperties & Record<`--${string}`, string>;

/** The open session or instance dialog: its kind, the instance or session it concerns and, for project dialogs, the project. */
export type DialogState = { type: string; targetName: string | null; sessionId: string | null; project?: { id: string; name: string } | null };

/** Where a phone/desktop request counter lives; sidebar and menu requests bump it so a late answer is dropped. */
export type RequestCounter = RefObject<number>;

/** The workbench store's state as `useWorkbench` selectors receive it (typed by the store once it is migrated). */
export type PageStore = ReturnType<typeof createWorkbenchStore>;

export type WorkbenchState = ReturnType<ReturnType<typeof createWorkbenchStore>["getSnapshot"]>;

/** A rejected /api call: an Error that may carry the backend's `code`, HTTP `status` and `details`. */
export type ApiFailure = { message: string; code?: string; status?: number; details?: { reason?: string; key?: string } };

/** The workbench store's action set and its raw same-origin /api client, as the page hands them to every region. */
export type PageActions = ReturnType<typeof createWorkbenchActions>;
export type PageApi = PageActions["api"];
