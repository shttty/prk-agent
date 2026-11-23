import { MONITOR_ROOM } from "../page-constants.js";
import { layout } from "../../layout/layout-store.js";
import { setWorkspaceOpen } from "./set-workspace-open.js";
import React from "react";
export function useMonitorFold({ mobile, fit, chrome, monitorPeek, sessionRow, monitorSheet, sidebarOpen, setMonitorPeek, workspaceOpen, setMonitorSheet }) {
  const monitorNarrow = !mobile && (fit?.chat ?? 0) < MONITOR_ROOM;
  const monitorFolded = !mobile && (chrome.monitorCollapsed || (monitorNarrow && !monitorPeek));
  const monitorUnfolded = Boolean(sessionRow) && (mobile ? monitorSheet && !sidebarOpen : !monitorFolded);
  const foldMonitor = (folded) => {
    setMonitorPeek(!folded && monitorNarrow);
    if (!folded || !monitorNarrow) layout.set({ monitorCollapsed: folded });
  };
  function toggleMonitor() {
    if (mobile) {
      // Phone: one full-screen or sheet panel at a time; opening the monitor sheet closes the workspace overlay.
      if (!monitorSheet && workspaceOpen) setWorkspaceOpen(false);
      setMonitorSheet((value) => !value);
    } else foldMonitor(monitorUnfolded);
  }
  return { monitorNarrow, monitorUnfolded, toggleMonitor };
}
