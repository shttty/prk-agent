import type { UiContext } from "../ui-types.ts";
import { finishDialog } from "./finish-dialog.ts";

export function onDialogAbort(ctx: UiContext, id: string): void { finishDialog(ctx, id, undefined); }
