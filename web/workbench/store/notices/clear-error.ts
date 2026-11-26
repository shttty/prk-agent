import type { StoreContext } from "../store-context-types.ts";
import { setError } from "./set-error.ts";

export function clearError(ctx: StoreContext) { setError(ctx, null); }
