import type { WorkbenchState } from "./store-types.ts";
import { initialSession } from "./initial-session.ts";
import { initialViewMode } from "./view-mode/initial-view-mode.ts";

export function initialState(): WorkbenchState {
  return {
    service: "loading",
    targets: [],
    sessions: new Map(),
    archive: [],
    unreadableSessions: [],
    sessionControl: null,
    selectedSessionId: null,
    session: initialSession(),
    extensionUiRenderIntervalMs: null,
    gatewayRestartUnit: null,
    workbenchLinkLosses: 0,
    workbenchLinked: false,
    viewMode: initialViewMode(),
    modelCatalog: { value: null, loading: false, error: null },
    attachments: [],
    references: [],
    showImages: true,
    draft: "",
    pending: new Set(),
    queue: "steer",
    presentation: null,
  };
}
