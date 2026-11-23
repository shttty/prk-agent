import type { AsyncLocalStorage } from "node:async_hooks";
import type { Extension, ExtensionContext, ExtensionUIContext, LoadExtensionsResult } from "@earendil-works/pi-coding-agent";

export type Handler = (...args: unknown[]) => Promise<unknown>;
export type ExtensionOverride = (base: LoadExtensionsResult) => LoadExtensionsResult;
export type BindExtensionUI = (extension: Extension, context: ExtensionContext) => ExtensionUIContext;

export interface ExtensionHandlerScope {
  override(base: LoadExtensionsResult, previous?: ExtensionOverride): LoadExtensionsResult;
  run<T>(action: () => Promise<T>): Promise<T>;
  runCell<T>(signal: AbortSignal, action: () => Promise<T>): Promise<T>;
  cancel(): void;
  close(): void;
}

export interface InvocationContext {
  signal?: AbortSignal;
  invocation: AsyncLocalStorage<{ signal?: AbortSignal; cellSignal?: AbortSignal }>;
  lifetime: AbortController;
  reason: DOMException;
  active: Set<AbortController>;
  shutdownControllers: Set<AbortController>;
  wrappers: WeakMap<Extension, WeakMap<Handler, Handler>>;
  bindUI?: BindExtensionUI;
  idle: AbortController;
}
