import type { Dispatch, SetStateAction } from "react";
import type { LayoutState } from "../../layout/layout-types.ts";
import { MONITOR_ROOM } from "../page-constants.ts";
import { layout } from "../../layout/layout-store.ts";
import { setWorkspaceOpen } from "./set-workspace-open.ts";
import type { SelectedRow } from "../../../workbench/store/store-types.ts";
type MonitorFoldOptions = {
  mobile: boolean; fit: { chat: number } | null; chrome: LayoutState; monitorPeek: boolean; sessionRow: SelectedRow | undefined; monitorSheet: boolean;
  sidebarOpen: boolean; setMonitorPeek: Dispatch<SetStateAction<boolean>>; workspaceOpen: boolean; setMonitorSheet: Dispatch<SetStateAction<boolean>>;
};

export function useMonitorFold({ mobile, fit, chrome, monitorPeek, sessionRow, monitorSheet, sidebarOpen, setMonitorPeek, workspaceOpen, setMonitorSheet }: MonitorFoldOptions) {
  const monitorNarrow = !mobile && (fit?.chat ?? 0) < MONITOR_ROOM;
  const monitorFolded = !mobile && (chrome.monitorCollapsed || (monitorNarrow && !monitorPeek));
  const monitorUnfolded = Boolean(sessionRow) && (mobile ? monitorSheet && !sidebarOpen : !workspaceOpen && !monitorFolded);
  const foldMonitor = (folded: boolean) => {
    setMonitorPeek(!folded && monitorNarrow);
    if (!folded || !monitorNarrow) layout.set({ monitorCollapsed: folded });
  };
  function toggleMonitor() {
    if (mobile) {
      // Phone: one full-screen or sheet panel at a time; opening the monitor sheet closes the workspace overlay.
      if (!monitorSheet && workspaceOpen) setWorkspaceOpen(false);
      setMonitorSheet((value) => !value);
    } else {
      if (workspaceOpen) setWorkspaceOpen(false);
      foldMonitor(monitorUnfolded);
    }
  }
  return { monitorNarrow, monitorUnfolded, toggleMonitor };
}
