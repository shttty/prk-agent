import { initialSession } from "./initial-session.js";
import { initialViewMode } from "./view-mode/initial-view-mode.js";
export function initialState() {
  return {
    service: "loading",
    targets: [],
    sessions: new Map(),
    /** Archive groups from the Gateway workbench: [{ group, label, at, sessions: [{ sessionId, label, owner, lifecycle, kernelOrphan }] }]. */
    archive: [],
    /** Sessions whose stored data cannot be read, from the Gateway workbench: [{ location: "active"|"archived"|"unknown", sessionId, sessionFile, reason, label, target, archived: { group, at, kernelOrphan } | null }]. Diagnostics only; never in `sessions`. */
    unreadableSessions: [],
    /** Gateway role designations `{ rootSessionId, supervisors: { projectId: sessionId } }` from the workbench snapshot and `session_control_changed`; null until the first snapshot. */
    sessionControl: null,
    selectedSessionId: null,
    session: initialSession(),
    extensionUiRenderIntervalMs: null,
    gatewayRestartUnit: null,
    /** Count of workbench-stream losses (a waiting page compares it with the value it started under) and whether the
     *  stream is open now (progress can be observed; a retry waits for it). */
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

