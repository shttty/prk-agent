import { AsyncLocalStorage } from "node:async_hooks";
import type { KernelCellIdentity } from "../kernel-types.ts";

export const askCellScope = new AsyncLocalStorage<KernelCellIdentity>();
