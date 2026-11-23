import type { AgentSession } from "@earendil-works/pi-coding-agent";
import type { HostedExtensionUI } from "../extension-ui/ui-types.ts";
import type { SessionHost } from "./host-types.ts";
import { unsupported } from "./extensions/unsupported.ts";
import { waitForIdle } from "./extensions/wait-for-idle.ts";
import { reload } from "./extensions/bind-hosted-extensions-reload.ts";
import { abortHandler } from "./extensions/abort-handler.ts";
import { shutdownHandler } from "./extensions/shutdown-handler.ts";
import { onError } from "./extensions/on-error.ts";

export interface HostedExtensionsContext {
  session: AgentSession;
  host: SessionHost;
  ui: HostedExtensionUI;
}

export async function bindHostedExtensions(session: AgentSession, host: SessionHost, ui: HostedExtensionUI): Promise<void> {
  const ctx: HostedExtensionsContext = { session, host, ui };
  await session.bindExtensions({
    mode: "tui",
    uiContext: ui.context,
    commandContextActions: {
      waitForIdle: () => waitForIdle(ctx),
      newSession: unsupported, switchSession: unsupported, fork: unsupported, navigateTree: unsupported,
      reload: () => reload(ctx),
    },
    abortHandler: () => abortHandler(ctx),
    shutdownHandler: () => shutdownHandler(ctx),
    onError: (error) => onError(ctx, error),
  });
}
