import type { ReactNode } from "react";
import type { DockviewReadyEvent } from "dockview-react";
import { createPortal } from "react-dom";
import { useCallback } from "react";
import { useEffect } from "react";
import { useEffectEvent } from "react";
import { useRef } from "react";
import { useState } from "react";
import { DockviewReact } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import "../../workspace/editor-dock/editor-dock.css";
import "../../workspace/file-tree/file-tree.css";
import "./stage.css";
import type { CssVars, PageApi } from "../page/page-types.ts";
import type { DiffRequest, TerminalRequest } from "../../workspace/session-workspace/workspace-types.ts";
import { THEME } from "../../workspace/editor-dock/EditorDock.tsx";
import { NoWatermark } from "../../workspace/editor-dock/NoWatermark.ts";
import { createEngine } from "../../workspace/editor-dock/engine/assemble-engine.ts";
import { EditorContext } from "../../workspace/file-editor/editor-context.ts";
import { TerminalContext } from "../../workspace/terminal/terminal-context.ts";
import { nextShellName } from "../../workspace/terminal/next-shell-name.ts";
import { useSessionWorkspace } from "../../workspace/session-workspace/use-session-workspace.ts";
import { WorkspaceDialogs } from "../../workspace/session-workspace/WorkspaceDialogs.tsx";
import { useLayout } from "../layout/use-layout.ts";
import { layout } from "../layout/layout-store.ts";
import { readGrid } from "../layout/read-grid.ts";
import { saveGrid } from "../layout/save-grid.ts";
import { CHAT_ID } from "./grid/stage-constants.ts";
import { seedGrid } from "./grid/seed-grid.ts";
import { workspaceView } from "./grid/workspace-view.ts";
import { holdGroupSizes } from "./grid/hold-group-sizes.ts";
import { preferredSizes } from "./grid/preferred-sizes.ts";
import { leafExtents } from "./grid/leaf-extents.ts";
import { chatGroup } from "./grid/chat-group.ts";
import { stageGrid } from "./grid/grid-of.ts";
import { refuseTopDrops } from "./grid/refuse-top-drops.ts";
import { measureShape } from "./measure-shape.ts";
import { clampTreeWidth } from "./clamp-tree-width.ts";
import { STAGE_COMPONENTS } from "./stage-parts.ts";
import { STAGE_TABS } from "./stage-parts.ts";
import { StageChat } from "./stage-parts.ts";
import { StageControls } from "./StageControls.tsx";
import { StageControlsContext } from "./stage-controls-context.ts";
import { StageCorner } from "./stage-corner.ts";
import { StageTree } from "./StageTree.tsx";
import { CornerActions } from "./CornerActions.tsx";
import { LayoutMenu } from "./presets/LayoutMenu.tsx";
import { applyPreset } from "./presets/apply-preset.ts";
import { presetOf } from "./presets/preset-of.ts";
import { BUILTIN_PRESETS } from "./presets/builtin-presets.ts";
import type { Preset } from "./presets/preset-types.ts";
import { useWorkspaceVisibility } from "./use-workspace-visibility.ts";
import type { StageControlsHost, StageDock, StageShape } from "./stage-types.ts";

const sameShape = (a: StageShape, b: StageShape) => a.groups === b.groups && a.chatWidth === b.chatWidth && a.chatCorner === b.chatCorner;

type DesktopStageProps = {
  api: PageApi; sessionId: string; target: string; cwd: string; place: string; refreshKey: string; terminalEnabled: boolean; workspaceAvailable: boolean;
  recoverButton: ReactNode; chat: ReactNode; onShape: (shape: StageShape) => void; onEditorOpen: (open: boolean) => void;
  diffRequest: DiffRequest | null; onDiffServed: () => void; terminalRequest: TerminalRequest | null; onTerminalServed: () => void; onQuote: (text: string) => void;
};

/** Desktop stage: one dockview grid holding the chat (a header-less, locked group) and the session's file, diff and
 * shell tabs docked around it, plus the directory (popover or pinned column) and the top-right buttons. The grid is
 * saved per session as it changes (with its main area, the group that absorbs size changes) and restored as it was.
 * A layout picked from the menu re-arranges it at once and is remembered (every session) for where new tabs land. Collapsing the workspace maximizes the chat's group (the
 * rest stays mounted). `chat`: the chat column node; `onShape(shape)`: see measureShape; `onEditorOpen(open)`: whether a
 * tab is open. Keyed by session. */
export default function DesktopStage({ api, sessionId, target, cwd, place, refreshKey, terminalEnabled, workspaceAvailable, recoverButton, chat, onShape, onEditorOpen, diffRequest, onDiffServed, terminalRequest, onTerminalServed, onQuote }: DesktopStageProps) {
  const { workspaceOpen: open, treeOpen, treePinned, treeWidth: savedTreeWidth, resets } = useLayout();
  const treeWidth = clampTreeWidth(savedTreeWidth);
  const resetsSeen = useRef(resets);
  const frame = useRef<HTMLDivElement>(null);
  const teardown = useRef<(() => void) | null>(null);
  const main = useRef<string | null>(null); // the main area's group id (null: the chat's)
  const box = useRef<HTMLDivElement>(null);
  const gridSize = () => ({ width: box.current?.clientWidth ?? 0, height: box.current?.clientHeight ?? 0 });
  const [dock, setDock] = useState<StageDock | null>(null);
  const [groups, setGroups] = useState(1);
  const [chatCorner, setChatCorner] = useState(true);
  const [cornerSlot, setCornerSlot] = useState<HTMLElement | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [hasTabs, setHasTabs] = useState(false);
  const engine = dock?.engine ?? null;
  const work = useSessionWorkspace({ api, sessionId, target, engine, place, terminalEnabled, hidden: !open, refreshKey, terminalRequest, onTerminalServed, onQuote });
  const { store } = work;
  useWorkspaceVisibility({ engine, hidden: !open, hasTabs, treeOpen, terminalPending: terminalEnabled && !work.listed });

  const onReady = ({ api: grid }: DockviewReadyEvent) => {
    const seeded = seedGrid(grid, readGrid(sessionId), gridSize());
    main.current = seeded.main;
    const liveMain = () => (main.current && grid.getGroup(main.current) ? main.current : null);
    const extents = () => leafExtents({ ...stageGrid(grid.toJSON().grid), ...gridSize() });
    const sizing = preferredSizes(seeded.preferred);
    sizing.set(seeded.preferred, extents());
    const view = workspaceView(grid, gridSize);
    const created = createEngine(view);
    store.markRestored(created.paths());
    setActivePath(created.activePath());
    setHasTabs(created.count() > 0);
    created.listen();
    created.onChange((json) => setHasTabs(Boolean(json)));
    created.onActivePath(setActivePath);
    created.onPanelRemoved((path) => { if (path) store.forget(path); });
    let shape: StageShape | null = null;
    const measure = () => {
      const next = measureShape(grid);
      if (shape && sameShape(shape, next)) return;
      shape = next;
      setGroups(next.groups);
      setChatCorner(next.chatCorner);
      onShape(next);
    };
    const saving = grid.onDidLayoutChange(() => {
      sizing.observe(extents(), liveMain() ?? chatGroup(grid)?.id);
      saveGrid(sessionId, { ...grid.toJSON(), main: liveMain(), preferred: sizing.get() });
      measure();
    });
    const observer = new ResizeObserver(measure);
    if (frame.current) observer.observe(frame.current);
    const maximized = grid.onDidMaximizedGroupChange(measure);
    const parts = [saving, maximized, refuseTopDrops(grid), holdGroupSizes(grid, liveMain, gridSize, sizing), created, view];
    teardown.current = () => { observer.disconnect(); for (const part of parts) part.dispose(); };
    measure();
    setDock({ grid, engine: created, liveMain, sizing, extents });
  };
  useEffect(() => () => teardown.current?.(), []);

  useEffect(() => { onEditorOpen(hasTabs); }, [hasTabs, onEditorOpen]);
  // Collapsed: the chat's group maximized over the others (they keep their place, tabs and shells).
  useEffect(() => {
    if (!dock) return;
    const { grid } = dock;
    const chatPanel = grid.getPanel(CHAT_ID);
    if (open) { if (grid.hasMaximizedGroup()) grid.exitMaximizedGroup(); }
    else if (chatPanel && grid.groups.length > 1 && !grid.hasMaximizedGroup()) grid.maximizeGroup(chatPanel);
  }, [dock, open, groups]);
  const arrange = (preset: Preset, id: string) => {
    if (!dock) return;
    const applied = applyPreset(dock.grid, preset, gridSize);
    main.current = applied.main;
    dock.sizing.set(applied.preferred, dock.extents());
    saveGrid(sessionId, { ...dock.grid.toJSON(), main: main.current, preferred: applied.preferred });
    layout.set({ workspaceOpen: preset.workspaceOpen, lastPreset: id });
  };
  const resetArrangement = useEffectEvent(() => arrange(BUILTIN_PRESETS[0].layout, BUILTIN_PRESETS[0].id));
  // "重置布局" applies built-in layout 1 to this session's grid (nothing closes; the layout store reset the rest).
  useEffect(() => {
    if (!dock || resets === resetsSeen.current) return;
    resetsSeen.current = resets;
    resetArrangement();
  }, [dock, resets]);
  // A file clicked in the monitor card opens its diff tab (the page opens the workspace); served once, then cleared.
  useEffect(() => {
    if (!engine || !diffRequest || diffRequest.sessionId !== sessionId) return;
    engine.openDiff(diffRequest.path);
    onDiffServed();
  }, [engine, diffRequest, sessionId, onDiffServed]);
  const newTerminal = useCallback(() => engine?.openTerminal(nextShellName([...engine.terminalNames(), ...Object.keys(work.metadata)]), true), [engine, work.metadata]);

  // The buttons are plain content of whichever region holds the stage's top-right corner: a pinned, open directory (its
  // header), else the chat column's strip while the chat holds the corner, else the corner group's tab row.
  const host: StageControlsHost = open && treePinned && treeOpen ? "tree" : chatCorner ? "chat" : "dock";
  const controls = <StageControls recoverButton={recoverButton} workspaceAvailable={workspaceAvailable} open={open} terminalEnabled={terminalEnabled} treeOpen={treeOpen} treePinned={treePinned} onNewTerminal={newTerminal}
    layoutMenu={dock ? <LayoutMenu onApply={arrange} onCapture={() => presetOf(dock.grid.toJSON(), open, dock.liveMain(), dock.sizing.get())} /> : null} />;
  const treeStyle: CssVars = { "--pi-tree-width": `${treeWidth}px` };
  return <div className="pi-desktop-stage" id="desktop-stage" ref={frame} data-open={open ? "true" : undefined} style={treeStyle}>
    <div className="pi-stage-grid" ref={box}>
      <StageChat.Provider value={chat}>
        <StageCorner.Provider value={setCornerSlot}>
          <StageControlsContext.Provider value={{ host, controls }}>
            <EditorContext.Provider value={work.editor}>
              <TerminalContext.Provider value={work.terminal}>
                <DockviewReact className="pi-dockview" theme={THEME} components={STAGE_COMPONENTS} tabComponents={STAGE_TABS} rightHeaderActionsComponent={CornerActions}
                  watermarkComponent={NoWatermark} disableFloatingGroups hideBorders scrollbars="native" onReady={onReady} />
              </TerminalContext.Provider>
            </EditorContext.Provider>
          </StageControlsContext.Provider>
        </StageCorner.Provider>
      </StageChat.Provider>
    </div>
    <StageTree api={api} sessionId={sessionId} target={target} cwd={cwd} shown={open} activePath={activePath} engine={engine} store={store} treeOpen={treeOpen} treePinned={treePinned} treeWidth={treeWidth} controls={host === "tree" ? controls : null} />
    {host === "chat" && cornerSlot ? createPortal(controls, cornerSlot) : null}
    <WorkspaceDialogs work={work} engine={engine} />
  </div>;
}
