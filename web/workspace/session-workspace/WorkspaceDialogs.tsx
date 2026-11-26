import type { Engine } from "../editor-dock/engine/engine-types.ts";
import type { useSessionWorkspace } from "./use-session-workspace.ts";
import { ConfirmCloseDialog } from "../pane/ConfirmCloseDialog.tsx";
import { EndTerminalDialog } from "../terminal/EndTerminalDialog.tsx";

/** The workspace's confirmations (closing a tab with unsaved text, ending a shell) for `work` from useSessionWorkspace. */
type WorkspaceDialogsProps = { work: ReturnType<typeof useSessionWorkspace>; engine: Engine | null };

export function WorkspaceDialogs({ work, engine }: WorkspaceDialogsProps) {
  const { confirmClose, setConfirmClose, end, metadata } = work;
  return <>
    <ConfirmCloseDialog confirm={confirmClose} onCancel={() => setConfirmClose(null)} onDiscard={(id: string) => { setConfirmClose(null); engine?.close(id); }} />
    <EndTerminalDialog ending={end.ending} error={end.error} busy={end.busy} noCleanupAfterDisconnect={(end.ending === null ? undefined : metadata[end.ending])?.cleanup === "normal-close-only"} onCancel={end.cancel} onConfirm={() => void end.confirm()} />
  </>;
}
