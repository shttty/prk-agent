import { AsyncLocalStorage } from "node:async_hooks";
import { EXTENSION_HANDLER_ABORT_MESSAGE } from "./invocation-constants.ts";
import type { BindExtensionUI, InvocationContext, ExtensionHandlerScope } from "./invocation-types.ts";
import { override } from "./format-extensions.ts";
import { run } from "./run-invocation.ts";
import { cancel } from "./cancel-invocations.ts";
import { close } from "./close-invocations.ts";

/** Cancellation belongs to PRK's SDK invocation, never a second execution/queue authority. */
export function createExtensionHandlerScope(signal?: AbortSignal, bindUI?: BindExtensionUI): ExtensionHandlerScope {
  // Async resources can outlive the SDK call that created them.
  const invocation: InvocationContext["invocation"] = new AsyncLocalStorage();
  const lifetime = new AbortController();
  const reason = new DOMException(EXTENSION_HANDLER_ABORT_MESSAGE, "AbortError");
  const active = new Set<AbortController>();
  const shutdownControllers = new Set<AbortController>();
  const idle = new AbortController();
  const ctx: InvocationContext = { signal, invocation, lifetime, reason, active, shutdownControllers, wrappers: new WeakMap(), bindUI, idle };
  return {
    override: (base, previous) => override(ctx, base, previous),
    run: (action) => run(ctx, action),
    runCell: (cellSignal, action) => invocation.run({ cellSignal }, action),
    cancel: () => cancel(ctx),
    close: () => close(ctx),
  };
}
