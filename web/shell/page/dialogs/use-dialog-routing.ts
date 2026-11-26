import type { Dispatch, SetStateAction } from "react";
import type { DialogState, PageActions, RequestCounter } from "../page-types.ts";
import { useMemo } from "react";
/**
 * Stable handlers that route sidebar/menu requests to dialogs, settings or session actions. They read the current
 * selection from the store when called, so they never change and memoized regions (the sidebar) keep their props.
 */
type DialogRoutingOptions = {
  sessionRequest: RequestCounter; setDialog: Dispatch<SetStateAction<DialogState | null>>; actions: PageActions; setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsSection: Dispatch<SetStateAction<string | null>>; setSettingsOpen: Dispatch<SetStateAction<boolean>>; setDialogSerial: Dispatch<SetStateAction<number>>;
  store: { getSnapshot: () => { selectedSessionId: string | null; sessions: Map<string, unknown> } };
};

export function useDialogRouting({ sessionRequest, setDialog, actions, setSidebarOpen, setSettingsSection, setSettingsOpen, setDialogSerial, store }: DialogRoutingOptions) {
  return useMemo(() => {
    const selectSession = (name: string) => { sessionRequest.current += 1; setDialog(null); void actions.selectSession(name); setSidebarOpen(false); };
    const showSettings = (section: string | null) => { setSidebarOpen(false); setSettingsSection(section); setSettingsOpen(true); };
    // `project` ({id,name} | null) rides along for project-scoped dialogs; omitted for the rest.
    const open = (type: string, targetName?: string | null, project?: { id: string; name: string } | null) => {
      sessionRequest.current += 1;
      if (type === "targets") { showSettings("targets"); return; }
      setSidebarOpen(false);
      const sessionId = ["rename", "derivation", "close", "project", "delete", "retarget"].includes(type) ? store.getSnapshot().selectedSessionId : null;
      setDialogSerial((value) => value + 1);
      setDialog({ type, targetName: targetName || sessionId, sessionId, ...(project === undefined ? {} : { project }) });
    };
    const sessionAction = async (type: string, name: string) => {
      const request = ++sessionRequest.current;
      setDialog(null);
      setSidebarOpen(false);
      if (store.getSnapshot().selectedSessionId !== name && await actions.selectSession(name) === false) return;
      const current = store.getSnapshot();
      if (request !== sessionRequest.current || current.selectedSessionId !== name || !current.sessions.has(name)) return;
      if (type === "recover") { await actions.recoverSession("auto"); return; }
      if (type === "clone") { await actions.executeNativeAction("clone", {}, { transcript: false }); return; }
      if (type === "reload") { await actions.executeNativeAction("reload", {}, { transcript: false }); return; }
      if (type === "export-html" || type === "export-jsonl") { await actions.executeNativeAction("export", { format: type.slice("export-".length) }, { transcript: false }); return; }
      setDialogSerial((value) => value + 1);
      setDialog({ type, targetName: name, sessionId: name });
    };
    return { selectSession, open, openSettings: () => showSettings(null), sessionAction };
  }, [sessionRequest, setDialog, actions, setSidebarOpen, setSettingsSection, setSettingsOpen, setDialogSerial, store]);
}
