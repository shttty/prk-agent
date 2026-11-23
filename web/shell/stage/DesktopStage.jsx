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
import { THEME } from "../../workspace/editor-dock/EditorDock.jsx";
import { NoWatermark } from "../../workspace/editor-dock/NoWatermark.jsx";
import { createEngine } from "../../workspace/editor-dock/engine/assemble-engine.js";
import { EditorContext } from "../../workspace/file-editor/editor-context.js";
import { TerminalContext } from "../../workspace/terminal/terminal-context.js";
import { nextShellName } from "../../workspace/terminal/next-shell-name.js";
import { useSessionWorkspace } from "../../workspace/session-workspace/use-session-workspace.js";
import { WorkspaceDialogs } from "../../workspace/session-workspace/WorkspaceDialogs.jsx";
import { useLayout } from "../layout/use-layout.js";
import { readGrid } from "../layout/layout-store.js";
import { layout } from "../layout/layout-store.js";
import { saveGrid } from "../layout/layout-store.js";
import { CONTROLS_W_CLOSED } from "../page/page-constants.js";
import { CONTROLS_W } from "../page/page-constants.js";
import { CONTROLS_W_RECOVER_EXTRA } from "../page/page-constants.js";
import { CHAT_ID } from "./grid/stage-constants.js";
import { seedGrid } from "./grid/seed-grid.js";
import { workspaceView } from "./grid/workspace-view.js";
import { holdGroupSizes } from "./grid/hold-group-sizes.js";
import { preferredSizes } from "./grid/preferred-sizes.js";
import { leafExtents } from "./grid/leaf-extents.js";
import { chatGroup } from "./grid/chat-group.js";
import { refuseTopDrops } from "./grid/refuse-top-drops.js";
import { measureShape } from "./measure-shape.js";
import { clampTreeWidth } from "./clamp-tree-width.js";
import { STAGE_COMPONENTS } from "./stage-parts.jsx";
import { STAGE_TABS } from "./stage-parts.jsx";
import { StageChat } from "./stage-parts.jsx";
import { StageControls } from "./StageControls.jsx";
import { StageTree } from "./StageTree.jsx";
import { TopRightReserve } from "./TopRightReserve.jsx";
import { LayoutMenu } from "./presets/LayoutMenu.jsx";
import { applyPreset } from "./presets/apply-preset.js";
import { presetOf } from "./presets/preset-of.js";
import { BUILTIN_PRESETS } from "./presets/builtin-presets.js";
import { useWorkspaceVisibility } from "./use-workspace-visibility.js";

const sameShape = (a, b) => a.groups === b.groups && a.chatWidth === b.chatWidth && a.chatCorner === b.chatCorner;

/** Desktop stage: one dockview grid holding the chat (a header-less, locked group) and the session's file, diff and
 * shell tabs docked around it, plus the directory (popover or pinned column) and the top-right buttons. The grid is
 * saved per session as it changes (with its main area, the group that absorbs size changes) and restored as it was.
 * A layout picked from the menu re-arranges it at once and is remembered (every session) for where new tabs land. Collapsing the workspace maximizes the chat's group (the
 * rest stays mounted). `chat`: the chat column node; `onShape(shape)`: see measureShape; `onEditorOpen(open)`: whether a
 * tab is open. Keyed by session. */
export default function DesktopStage({ api, sessionId, target, cwd, place, refreshKey, terminalEnabled, workspaceAvailable, recoverButton, chat, onShape, onEditorOpen, diffRequest, onDiffServed, terminalRequest, onTerminalServed, onQuote }) {
  const { workspaceOpen: open, treeOpen, treePinned, treeWidth: savedTreeWidth, resets } = useLayout();
  const treeWidth = clampTreeWidth(savedTreeWidth);
  const resetsSeen = useRef(resets);
  const frame = useRef(null);
  const teardown = useRef(null);
  const main = useRef(null); // the main area's group id (null: the chat's)
  const box = useRef(null);
  const gridSize = () => ({ width: box.current?.clientWidth ?? 0, height: box.current?.clientHeight ?? 0 });
  const [dock, setDock] = useState(null);
  const [groups, setGroups] = useState(1);
  const [activePath, setActivePath] = useState(null);
  const [hasTabs, setHasTabs] = useState(false);
  const engine = dock?.engine ?? null;
  const work = useSessionWorkspace({ api, sessionId, target, engine, place, terminalEnabled, hidden: !open, refreshKey, terminalRequest, onTerminalServed, onQuote });
  const { store } = work;
  useWorkspaceVisibility({ engine, hidden: !open, hasTabs, treeOpen, terminalPending: terminalEnabled && !work.listed });

  const onReady = ({ api: grid }) => {
    const seeded = seedGrid(grid, readGrid(sessionId), gridSize());
    main.current = seeded.main;
    const liveMain = () => (main.current && grid.getGroup(main.current) ? main.current : null);
    const extents = () => leafExtents({ ...grid.toJSON().grid, ...gridSize() });
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
    let shape = null;
    const measure = () => {
      const next = measureShape(grid, frame.current);
      if (shape && sameShape(shape, next)) return;
      shape = next;
      setGroups(next.groups);
      onShape(next);
    };
    const saving = grid.onDidLayoutChange(() => {
      sizing.observe(extents(), liveMain() ?? chatGroup(grid)?.id);
      saveGrid(sessionId, { ...grid.toJSON(), main: liveMain(), preferred: sizing.get() });
      measure();
    });
    const observer = new ResizeObserver(measure);
    observer.observe(frame.current);
    const parts = [saving, refuseTopDrops(grid), holdGroupSizes(grid, liveMain, gridSize, sizing), created, view];
    teardown.current = () => { observer.disconnect(); for (const part of parts) part.dispose(); };
    measure();
    setDock({ grid, engine: created, liveMain, sizing, extents });
  };
  useEffect(() => () => teardown.current?.(), []);

  useEffect(() => { onEditorOpen?.(hasTabs); }, [hasTabs, onEditorOpen]);
  // Collapsed: the chat's group maximized over the others (they keep their place, tabs and shells).
  useEffect(() => {
    if (!dock) return;
    const { grid } = dock;
    if (open) { if (grid.hasMaximizedGroup()) grid.exitMaximizedGroup(); }
    else if (grid.groups.length > 1 && !grid.hasMaximizedGroup()) grid.maximizeGroup(grid.getPanel(CHAT_ID));
  }, [dock, open, groups]);
  const arrange = (preset, id) => {
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
    onDiffServed?.();
  }, [engine, diffRequest, sessionId, onDiffServed]);
  const newTerminal = useCallback(() => engine?.openTerminal(nextShellName([...engine.terminalNames(), ...Object.keys(work.metadata)]), true), [engine, work.metadata]);

  const controlsWidth = (open && workspaceAvailable ? CONTROLS_W : CONTROLS_W_CLOSED) + (recoverButton ? CONTROLS_W_RECOVER_EXTRA : 0);
  const stripWidth = open ? ((terminalEnabled ? 1 : 0) + (treePinned && treeOpen ? 0 : 1)) * 28 : 0;
  return <div className="pi-desktop-stage" id="desktop-stage" ref={frame} data-open={open ? "true" : undefined}
    style={{ "--pi-controls-w": `${controlsWidth + (stripWidth ? stripWidth + 2 : 0)}px`, "--pi-stage-controls-w": `${controlsWidth}px`, "--pi-strip-w": `${stripWidth}px`, "--pi-tree-width": `${treeWidth}px` }}>
    <div className="pi-stage-grid" ref={box}>
      <StageChat.Provider value={chat}>
        <EditorContext.Provider value={work.editor}>
          <TerminalContext.Provider value={work.terminal}>
            <DockviewReact className="pi-dockview" theme={THEME} components={STAGE_COMPONENTS} tabComponents={STAGE_TABS} rightHeaderActionsComponent={TopRightReserve}
              watermarkComponent={NoWatermark} disableFloatingGroups hideBorders scrollbars="native" onReady={onReady} />
          </TerminalContext.Provider>
        </EditorContext.Provider>
      </StageChat.Provider>
    </div>
    <StageTree api={api} sessionId={sessionId} target={target} cwd={cwd} shown={open} activePath={activePath} engine={engine} store={store} treeOpen={treeOpen} treePinned={treePinned} treeWidth={treeWidth} />
    <StageControls recoverButton={recoverButton} workspaceAvailable={workspaceAvailable} open={open} terminalEnabled={terminalEnabled} treeOpen={treeOpen} treePinned={treePinned} onNewTerminal={newTerminal}
      layoutMenu={dock ? <LayoutMenu onApply={arrange} onCapture={() => presetOf(dock.grid.toJSON(), open, dock.liveMain(), dock.sizing.get())} /> : null} />
    <WorkspaceDialogs work={work} engine={engine} />
  </div>;
}
