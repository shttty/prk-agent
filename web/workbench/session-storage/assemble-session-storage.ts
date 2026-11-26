import type { SavedSessionChanges, SessionStorage, StorageContext } from "./session-storage-types.ts";
import { sessionState } from "./session-state.ts";
import { persistSession } from "./persist-session.ts";
import { persistSelectedSession } from "./persist-selected-session.ts";
import { rememberedSession } from "./remembered-session.ts";
import { forgetSession } from "./forget-session.ts";
import { normalizePresentation } from "./sanitizing/normalize-presentation.ts";
import { namespaceFor } from "./storage-access/namespace-for.ts";

export function createSessionStorage({ apiRoot = "/api", onStorageFailure }: { apiRoot?: string; onStorageFailure?: (message: string) => void } = {}): SessionStorage {
  const storageNamespace = namespaceFor(apiRoot);
  const ctx: StorageContext = {
    apiRoot,
    onStorageFailure,
    storageNamespace,
    memoryStorage: new Map(),
    selectedStorageKey: `${storageNamespace}:selected`,
    storageWarningShown: false,
  };
  return {
    sessionState: (sessionId: string) => sessionState(ctx, sessionId),
    persistSession: (sessionId: string, changes?: SavedSessionChanges) => persistSession(ctx, sessionId, changes),
    persistSelectedSession: (sessionId: string) => persistSelectedSession(ctx, sessionId),
    rememberedSession: () => rememberedSession(ctx),
    forgetSession: (sessionId: string) => forgetSession(ctx, sessionId),
    normalizePresentation,
  };
}
