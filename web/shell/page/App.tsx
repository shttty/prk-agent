import type { MouseEvent } from "react";
import type { PublicExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { CssVars, DialogState, PageStore, WorkbenchState } from "./page-types.ts";
import type { StageShape } from "../stage/stage-types.ts";
import type { DiffRequest, TerminalRequest } from "../../workspace/session-workspace/workspace-types.ts";
import "./page.css";
import { lazy } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { useLayout } from "../layout/use-layout.ts";
import { useRef } from "react";
import { useElementWidth } from "../layout/use-element-width.ts";
import { useTerminalShortcut } from "./chrome/use-terminal-shortcut.ts";
import { useEffect } from "react";
import { useDialogRouting } from "./dialogs/use-dialog-routing.ts";
import { AskAlert } from "../../chat/ask-alert/AskAlert.jsx";
import { useDialogActions } from "./dialogs/use-dialog-actions.ts";
import { Sidebar } from "../../sessions/sidebar/Sidebar.jsx";
import { layout } from "../layout/layout-store.ts";
import { handFocus } from "../layout/hand-focus.ts";
import { setWorkspaceOpen } from "./chrome/set-workspace-open.ts";
import { useCallback } from "react";
import { quoteDraft } from "../../chat/composer/quote-draft.js";
import { Button } from "@mantine/core";
import { IconPlugConnected } from "@tabler/icons-react";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { toggleWorkspace } from "./chrome/toggle-workspace.ts";
import { IconLayoutSidebarLeftExpand } from "@tabler/icons-react";
import { IconX } from "@tabler/icons-react";
import { Topbar } from "./chrome/Topbar.tsx";
import { ChatColumn } from "./ChatColumn.tsx";
import { ChromeMotion } from "./chrome/ChromeMotion.tsx";
import { useChromeWidths } from "./chrome/use-chrome-widths.ts";
import { useMonitorFold } from "./chrome/use-monitor-fold.ts";
import { Suspense } from "react";
import { resetLayout as resetPageLayout } from "./chrome/reset-layout.ts";
import { layoutContext as pageLayoutContext } from "./chrome/layout-context.ts";
import { SessionBanners } from "./banners/SessionBanners.tsx";
import { CARD_GAP } from "../layout/layout-table.ts";
import { Drawer } from "@mantine/core";
import { Group } from "@mantine/core";
import { Title } from "@mantine/core";
import { Notification } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Text } from "@mantine/core";
import { AppDialogs } from "./dialogs/AppDialogs.tsx";
import { findSessionRow } from "../../workbench/payloads/find-session-row.js";
export const WorkspacePane = lazy(() => import("../../workspace/pane/WorkspacePane.tsx"));
// Desktop: chat and workspace share one dockview grid (dockview, the panels' code) loaded with the first session.
const DesktopStage = lazy(() => import("../stage/DesktopStage.tsx"));

export const MonitorPanel = lazy(() => import("../../monitor/panel/MonitorPanel.jsx"));
/** The page shell. Its store subscription covers only the fields below; regions subscribe to their own (see useWorkbench). */
export default function App({ store }: { store: PageStore }) {
  const selectedSessionId = useWorkbench((state: WorkbenchState) => state.selectedSessionId);
  const sessionRow = useWorkbench((state: WorkbenchState) => findSessionRow(state, state.selectedSessionId));
  const status = useWorkbench((state: WorkbenchState) => state.session.snapshot?.state || state.sessions.get(state.selectedSessionId)?.state);
  const recovering = useWorkbench((state: WorkbenchState) => state.session.pending.has("recovering"));
  const notice = useWorkbench((state: WorkbenchState) => state.session.notice);
  const service = useWorkbench((state: WorkbenchState) => state.service);
  const hasTargets = useWorkbench((state: WorkbenchState) => state.targets.length > 0);
  const targetLabel = useWorkbench((state: WorkbenchState) => state.targets.find((target: PublicExecutionTarget) => target.id === state.sessions.get(state.selectedSessionId)?.target)?.label);
  const terminalRefreshKey = useWorkbench((state: WorkbenchState) => `${state.session.streamId || ""}:${state.session.terminalRefreshKey}`);
  const actions = store.actions;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mobile = useMediaQuery("(max-width: 48em)", false, { getInitialValueInEffect: false });
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // Chrome state (session sidebar, workspace, directory, their sizes) lives in the layout store.
  const chrome = useLayout();
  const { sessionOpen: sessionBarOpen, workspaceOpen } = chrome;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | null>(null);
  // Whether the mounted workspace of `sessionRow` has a tab open (reported by the stage / phone pane; the layout code
  // context records it).
  const [editorOpen, setEditorOpen] = useState<{ sessionId: string | null; open: boolean }>({ sessionId: null, open: false });
  const shell = useRef<HTMLDivElement>(null);
  const shellWidth = useElementWidth(shell);
  // Phone: the monitor sheet opens on demand (not saved). Desktop: a narrow chat column folds the panel to its button;
  // `monitorPeek` is the user unfolding it there anyway.
  const [monitorSheet, setMonitorSheet] = useState(false);
  const [monitorPeek, setMonitorPeek] = useState(false);
  // Bottom edge of the banner stack inside the chat column (0 = no stack): the plugin toasts start below it.
  const [bannerBottom, setBannerBottom] = useState(0);
  // Desktop: the chat's place in the stage grid as last laid out (see measureShape); null until the stage measured it.
  const [stageShape, setStageShape] = useState<StageShape | null>(null);
  // Phone: worker whose workspace was opened at least once: it stays mounted (hidden) afterwards so unsaved tabs, the
  // editor layout and the terminal's xterm connections survive collapsing.
  const [seenWorkspace, setSeenWorkspace] = useState<string | null>(null);
  const sessionRequest = useRef(0);
  // Bumped when a dialog opens so its form state starts fresh; only the content remounts,
  // the modal itself stays mounted so closing returns focus to whatever opened the first dialog.
  const [dialogSerial, setDialogSerial] = useState(0);
  const collapseSessionBar = useCallback((event: MouseEvent<HTMLElement>) => { layout.set({ sessionOpen: false }); handFocus(event, "expand-session-sidebar"); }, []);
  const activeSessionId = useWorkbench((state: WorkbenchState) => state.sessions.has(state.selectedSessionId) ? state.selectedSessionId : null);
  const closed = status === "closed" || sessionRow?.state === "closed";
  // No runtime and its last start failed; the next message tries again.
  const unavailable = Boolean(sessionRow && (status === "unavailable" || sessionRow.state === "unavailable"));
  // Every session has a Jupyter workspace; terminals additionally need a live runtime.
  const workspaceSessionId = activeSessionId;
  const terminalSessionId = workspaceSessionId && !closed && !unavailable && status !== "closed" ? workspaceSessionId : null;
  const workspaceAvailable = Boolean(workspaceSessionId || terminalSessionId);
  useTerminalShortcut({ enabled: workspaceAvailable });
  useEffect(() => { if (workspaceOpen && workspaceSessionId) setSeenWorkspace(workspaceSessionId); }, [workspaceOpen, workspaceSessionId]);
  useEffect(() => { void store.start(); return () => store.dispose(); }, [store]);
  useEffect(() => {
    if (dialog?.sessionId && dialog.sessionId !== selectedSessionId) setDialog(null);
  }, [dialog, selectedSessionId]);
  useEffect(() => { if (!mobile) setSidebarOpen(false); }, [mobile]);
  const { selectSession, open, openSettings, sessionAction } = useDialogRouting({ sessionRequest, setDialog, actions, setSidebarOpen, setSettingsSection, setSettingsOpen, setDialogSerial, store });
  const dialogMatches = !dialog?.sessionId || dialog.sessionId === selectedSessionId;
  // Stable per dialog: dialogs key their data loading on `actions`, so a fresh object on every
  // App render (any store update) would refetch, unmount open dropdowns and reset selections.
  const dialogSessionId = dialog?.sessionId;
  const { dialogActions } = useDialogActions({ actions, store, dialogSessionId });
  const sidebar = <Sidebar actions={actions} onCollapse={mobile ? undefined : collapseSessionBar} themeToggle={!mobile} onOpen={open} onSettings={openSettings} onSessionAction={sessionAction} onSelected={selectSession} />;
  // A file clicked in the monitor card: open the workspace and let it open that file's diff tab (served once, then cleared).
  const [diffRequest, setDiffRequest] = useState<DiffRequest | null>(null);
  const openMonitorDiff = useCallback((path: string) => {
    if (mobile) setMonitorSheet(false);
    if (!workspaceSessionId) return;
    setWorkspaceOpen(true);
    setDiffRequest({ sessionId: workspaceSessionId, path });
  }, [mobile, workspaceSessionId]);
  const selectMonitorChild = useCallback((name: string) => { if (mobile) setMonitorSheet(false); selectSession(name); }, [mobile, selectSession]);
  const clearDiffRequest = useCallback(() => setDiffRequest(null), []);
  const [terminalRequest, setTerminalRequest] = useState<TerminalRequest | null>(null);
  const viewTerminal = useCallback((sessionId: string, { name, generation }: { name: string; generation: string }) => {
    if (sessionId !== workspaceSessionId || !terminalSessionId) return;
    if (mobile) setMonitorSheet(false);
    setWorkspaceOpen(true);
    setTerminalRequest({ sessionId, name, generation });
  }, [mobile, terminalSessionId, workspaceSessionId]);
  const clearTerminalRequest = useCallback(() => setTerminalRequest(null), []);
  // A terminal selection quoted into this session's composer (the dock shows the selected session's shells). The phone's
  // workspace overlay covers the chat, so it closes first.
  const quoteToComposer = useCallback((text: string) => {
    if (mobile) setWorkspaceOpen(false);
    actions.setDraft(quoteDraft(store.getSnapshot().draft, text));
    window.setTimeout(() => document.getElementById("composer")?.focus(), 0);
  }, [mobile, actions, store]);
  const recoverButton = sessionRow && (closed || unavailable)
    ? <Button id="topbar-recover" size="compact-sm" variant="light" leftSection={<IconPlugConnected size={14} />} loading={recovering} onClick={() => void actions.recoverSession("auto")}>恢复</Button> : null;
  // The workspace (files, diffs, terminals) belongs to every session row; the toggle is enabled wherever there is one.
  const workspaceShown = Boolean(workspaceSessionId) && workspaceOpen;
  // Phone: the workspace overlay's own close button.
  const closeWorkspace = mobile ? <ActionIcon id="toggle-workspace" variant="subtle" color="gray" aria-label="关闭工作区" onClick={() => setWorkspaceOpen(false)}><IconX size={17} /></ActionIcon> : null;
  const expandSessionBar = <Tooltip label="展开会话栏"><ActionIcon id="expand-session-sidebar" className="pi-quiet-icon" size={26} variant="subtle" color="gray" aria-label="展开会话栏" onClick={(event) => { layout.set({ sessionOpen: true }); handFocus(event, "toggle-session-sidebar"); }}><IconLayoutSidebarLeftExpand size={17} /></ActionIcon></Tooltip>;
  const sessionFloat = !mobile && !sessionBarOpen;
  // Desktop: the sidebar's saved width fitted into the window (nothing saved is rewritten by this).
  const { fit, sessionSplitter } = useChromeWidths({ mobile, shellWidth, sessionBarOpen, chrome });
  const chatWidth = stageShape?.chatWidth ?? fit?.chat ?? 0;
  const filesOpen = Boolean(workspaceSessionId) && editorOpen.sessionId === workspaceSessionId && editorOpen.open;
  // Monitor panel: desktop at the right of the chat column, unfolded from the pill at its top corner (folded is saved
  // layout), phone a sheet on demand.
  const { monitorNarrow, monitorUnfolded, toggleMonitor } = useMonitorFold({ mobile, fit: mobile ? null : { chat: chatWidth }, chrome, monitorPeek, sessionRow, monitorSheet, sidebarOpen, setMonitorPeek, workspaceOpen: workspaceShown, setMonitorSheet });
  const monitorPlace = !sessionRow ? "" : targetLabel || sessionRow.target || "";
  // Keyed per session: its chart history (samples received while shown) starts over for another session.
  const monitorPanel = monitorUnfolded ? <Suspense fallback={null}><MonitorPanel key={sessionRow.sessionId} actions={actions} sessionRow={sessionRow} mobile={mobile} place={monitorPlace} onOpenDiff={openMonitorDiff} onSelectSession={selectMonitorChild} /></Suspense> : null;
  const onEditorOpen = useCallback((open: boolean) => setEditorOpen({ sessionId: workspaceSessionId, open }), [workspaceSessionId]);
  const resetLayout = useCallback(() => resetPageLayout(workspaceSessionId, seenWorkspace === workspaceSessionId), [workspaceSessionId, seenWorkspace]);
  const layoutContext = useCallback(() => pageLayoutContext(mobile, sessionRow, closed, status, filesOpen), [mobile, sessionRow, closed, status, filesOpen]);
  const closeDialog = useCallback(() => setDialog(null), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  // Session banners float over the top of the conversation column (the empty view when there is no session).
  const banners = <SessionBanners actions={actions} onBottom={setBannerBottom} />;
  const chatColumn = sessionRow ? <ChatColumn mobile={mobile} actions={actions} sessionRow={sessionRow} selectedSessionId={selectedSessionId} banners={banners} bannerBottom={bannerBottom} expandSessionBar={sessionFloat ? expandSessionBar : null}
    chatWidth={chatWidth} monitor={monitorUnfolded ? (monitorNarrow ? "overlay" : "panel") : "chip"} monitorUnfolded={monitorUnfolded} monitorPanel={monitorPanel} onToggleMonitor={toggleMonitor} onViewTerminal={viewTerminal} /> : null;
  const shellStyle: CssVars = { "--pi-card-gap": `${CARD_GAP}px`, ...(fit?.session ? { "--pi-sidebar-width": `${fit.session}px` } : {}) };
  return <div className="workbench" id="app-shell" ref={shell} data-desktop-stage={!mobile && sessionRow ? "" : undefined} style={shellStyle}>
    <AskAlert onOpen={selectSession} />
    {!mobile && <aside className="desktop-sidebar" hidden={!sessionBarOpen} aria-label="实例与会话列表">{sidebar}</aside>}
    <ChromeMotion mobile={mobile} sidebar={!mobile && sessionBarOpen} monitor={monitorUnfolded} pane={mobile && workspaceShown} workspace={workspaceShown} />
    {!mobile && sessionBarOpen ? <div className="pi-splitter is-x is-session" id="session-splitter" aria-label="调整会话栏宽度" {...sessionSplitter} /> : null}
    <Drawer opened={mobile && sidebarOpen} keepMounted onClose={() => setSidebarOpen(false)} title="实例与会话" closeButtonProps={{ "aria-label": "关闭会话列表" }} size={300} classNames={{ body: "mobile-sidebar-body" }}>
      {mobile && sidebar}
    </Drawer>
    <main className="workspace" id="workspace">
      <Topbar mobile={mobile} sessionRow={sessionRow} status={status} place={monitorPlace} sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen(true)} recoverButton={recoverButton}
        monitorSheet={monitorSheet} onToggleMonitor={toggleMonitor} workspaceAvailable={workspaceAvailable} workspaceOpen={workspaceOpen} onToggleWorkspace={() => { if (!workspaceOpen) setMonitorSheet(false); toggleWorkspace(); }} />
      {notice && <Notification className="workbench-notice" role="status" aria-live="polite" color={notice.tone === "warning" ? "yellow" : "blue"} onClose={actions.clearNotice} closeButtonProps={{ "aria-label": "关闭提示" }}>{notice.text}</Notification>}
      {sessionRow ? <div className="chat-container">{mobile && monitorPanel}<div className="pi-stage">
        {mobile ? <div className="pi-columns">
          {chatColumn}
          {workspaceSessionId && seenWorkspace === workspaceSessionId ? <Suspense fallback={null}><WorkspacePane key={workspaceSessionId} api={actions.api} sessionId={workspaceSessionId} target={sessionRow.target} cwd={sessionRow.cwd} hidden={!workspaceOpen} controls={workspaceOpen ? closeWorkspace : null} place={monitorPlace} refreshKey={terminalRefreshKey} terminalEnabled={Boolean(terminalSessionId)} onEditorOpen={onEditorOpen} diffRequest={diffRequest} onDiffServed={clearDiffRequest} terminalRequest={terminalRequest} onTerminalServed={clearTerminalRequest} onQuote={quoteToComposer} /></Suspense> : null}
        </div> : <Suspense fallback={null}><DesktopStage key={workspaceSessionId} api={actions.api} sessionId={workspaceSessionId} target={sessionRow.target} cwd={sessionRow.cwd} place={monitorPlace} refreshKey={terminalRefreshKey}
          terminalEnabled={Boolean(terminalSessionId)} workspaceAvailable={workspaceAvailable} recoverButton={recoverButton} chat={chatColumn} onShape={setStageShape} onEditorOpen={onEditorOpen} diffRequest={diffRequest} onDiffServed={clearDiffRequest} terminalRequest={terminalRequest} onTerminalServed={clearTerminalRequest} onQuote={quoteToComposer} /></Suspense>}
      </div></div> : <section className="empty-view" id="empty-view">
        {banners}
        {sessionFloat && expandSessionBar}
        {service === "loading" ? <><Loader size="sm" /><Text c="dimmed">正在连接工作台…</Text></> : <>
          <div className="empty-wordmark" aria-hidden="true">Pi.</div>
          <Title order={2} size="h2">{service === "error" ? "暂时无法连接工作台" : "从一个会话开始"}</Title>
          {service === "error" ? <Button id="retry-load" onClick={() => actions.start()}>重新连接</Button> : <Group justify="center"><Button id="create-session-empty" onClick={() => open("create")}>新建会话</Button>{!hasTargets && <Button id="add-target-empty" variant="default" onClick={() => open("targets")}>添加实例</Button>}</Group>}
        </>}
      </section>}
    </main>
    <AppDialogs dialog={dialog} dialogMatches={dialogMatches} dialogSerial={dialogSerial} actions={actions} dialogActions={dialogActions} mobile={mobile} onCloseDialog={closeDialog}
      settingsOpen={settingsOpen} settingsSection={settingsSection} onCloseSettings={closeSettings} onReset={resetLayout} layoutContext={layoutContext} />
  </div>;
}
