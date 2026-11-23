import type { UiContext, Dialog } from "../ui-types.ts";
import { publish } from "../publication/publish-revision.ts";
import { finishDialog } from "./finish-dialog.ts";
import { onDialogAbort } from "./on-abort.ts";
import { resolveDialog } from "./resolve.ts";
import { randomUUID } from "node:crypto";

export function createDialog<T>(ctx: UiContext, kind: Dialog["kind"], title: string, extra: Omit<Dialog, "id" | "kind" | "title" | "resolve" | "timer" | "abort" | "onAbort">, options?: { signal?: AbortSignal; timeout?: number; onTimeout?: () => T }): Promise<T | undefined> {
    let resolvePromise: (value: T | undefined) => void = () => undefined;
    const promise = new Promise<T | undefined>((resolve) => { resolvePromise = resolve; });
    const id = randomUUID();
    const onAbort = (): void => onDialogAbort(ctx, id);
    const timeout = options?.timeout && options.timeout > 0 ? setTimeout(() => finishDialog(ctx, id, options.onTimeout?.()), options.timeout) : undefined;
    const abort = options?.signal;
    const dialog: Dialog = { id, kind, title, ...extra, ...(options?.timeout && options.timeout > 0 ? { expiresAt: Date.now() + options.timeout } : {}), resolve: (value) => resolveDialog<T>(resolvePromise, value), timer: timeout, abort, onAbort };
    ctx.dialogs.set(id, dialog);
    if (abort?.aborted) onAbort(); else abort?.addEventListener("abort", onAbort, { once: true });
    publish(ctx);
    return promise;
  }
