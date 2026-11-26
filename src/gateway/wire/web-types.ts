// The only src/ file web/ may import, and only with `import type` (enforced by web's eslint config): the wire and
// snapshot shapes the browser receives. Declare a shape by re-exporting it from the subsystem that owns it; never
// copy it into web/. web/tsconfig.json type-checks every src file these re-exports reach.

// Shared by several web directories
export type { PublicExecutionTarget } from "../instances/instance-types.ts";
export type { KernelSnapshot } from "../../kernel/kernel-types.ts";
export type { ManagedSessionSnapshot } from "../../sessions/collection/collection-types.ts";
export type { SessionSnapshot, WorkbenchSnapshot } from "../session-views/session-view-types.ts";
export type { PeerDelivery, PeerMessage } from "../../../shared/session-messages/message-types.ts";
export type { ThemeDocument, ThemeEntry, ThemeImport, ThemeLibrary, ThemePreview, ThemeWarning } from "../../../shared/themes.ts";

// web/workbench


// web/instances, web/monitor, web/sessions


// web/settings, web/shell, web/workspace


// web/chat
