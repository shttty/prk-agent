import type { stored } from "./selection/read-stored-session.ts";
import type { storedSession } from "./selection/require-stored-session.ts";
import type { workbenchSnapshot } from "./snapshots/format-workbench.ts";
import type { managedSessionSnapshot } from "./snapshots/format-session.ts";
import type { managed } from "./snapshots/format-managed-sessions.ts";
import type { unavailableSession } from "./snapshots/unavailable-session.ts";
import type { archivedSnapshot } from "./snapshots/format-archived-snapshot.ts";
import type { archivedStream } from "./snapshots/read-archived-stream.ts";
import type { historicalResult } from "./snapshots/format-recovery-result.ts";
import type { decorateSnapshot } from "./snapshots/format-active-snapshot.ts";
import type { projectExtensionRender } from "./extension-ui/format-extension-render.ts";
import type { sessionHost } from "./get-session-host.ts";
import type { forgetHost } from "./host-binding/forget-session-host.ts";
import type { history } from "./history/read-history.ts";
import type { historyPage } from "./history/read-history-page.ts";
import type { toolContent } from "./history/read-tool-content.ts";
import type { kernelResult } from "./history/read-kernel-result.ts";
import type { state } from "./snapshots/read-state.ts";

type WithoutContext<T> = T extends (ctx: never, ...args: infer A) => infer R ? (...args: A) => R : never;

export interface SessionViewsMethods {
  stored: WithoutContext<typeof stored>;
  storedSession: WithoutContext<typeof storedSession>;
  workbenchSnapshot: WithoutContext<typeof workbenchSnapshot>;
  managedSessionSnapshot: WithoutContext<typeof managedSessionSnapshot>;
  managed: WithoutContext<typeof managed>;
  unavailableSession: WithoutContext<typeof unavailableSession>;
  archivedSnapshot: WithoutContext<typeof archivedSnapshot>;
  archivedStream: WithoutContext<typeof archivedStream>;
  historicalResult: WithoutContext<typeof historicalResult>;
  decorateSnapshot: WithoutContext<typeof decorateSnapshot>;
  projectExtensionRender: WithoutContext<typeof projectExtensionRender>;
  sessionHost: WithoutContext<typeof sessionHost>;
  forgetHost: WithoutContext<typeof forgetHost>;
  history: WithoutContext<typeof history>;
  historyPage: WithoutContext<typeof historyPage>;
  toolContent: WithoutContext<typeof toolContent>;
  kernelResult: WithoutContext<typeof kernelResult>;
  state: WithoutContext<typeof state>;
}
