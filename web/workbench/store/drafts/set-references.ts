import type { StoreContext } from "../store-context-types.ts";
import type { StoredReference } from "../../session-storage/session-storage-types.ts";
import { patch } from "../updates/patch.ts";
import { persistCurrentSession } from "./persist-current-session.ts";

export function setReferences(ctx: StoreContext, value: StoredReference[]) { patch(ctx, { references: value }); persistCurrentSession(ctx); }
