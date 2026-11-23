import { ConfirmCloseDialog } from "../pane/ConfirmCloseDialog.jsx";
import { EndTerminalDialog } from "../terminal/EndTerminalDialog.jsx";

/** The workspace's confirmations (closing a tab with unsaved text, ending a shell) for `work` from useSessionWorkspace. */
export function WorkspaceDialogs({ work, engine }) {
  const { confirmClose, setConfirmClose, end, metadata } = work;
  return <>
    <ConfirmCloseDialog confirm={confirmClose} onCancel={() => setConfirmClose(null)} onDiscard={(id) => { setConfirmClose(null); engine?.close(id); }} />
    <EndTerminalDialog ending={end.ending} error={end.error} busy={end.busy} noCleanupAfterDisconnect={metadata[end.ending]?.cleanup === "normal-close-only"} onCancel={end.cancel} onConfirm={end.confirm} />
  </>;
}
