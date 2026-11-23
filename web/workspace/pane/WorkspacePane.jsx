import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useEffect } from "react";
import { lazy } from "react";
import { useLayout } from "../../shell/layout/use-layout.js";
import { editorLayoutKey } from "../editor-layout/editor-layout-key.js";
import FileTree from "../file-tree/FileTree.jsx";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import { IconTerminal2 } from "@tabler/icons-react";
import { EditorContext } from "../file-editor/editor-context.js";
import { TerminalContext } from "../terminal/terminal-context.js";
import { EditorDock } from "../editor-dock/EditorDock.jsx";
import { FilePanel } from "../file-editor/FilePanel.jsx";
import { FileTab } from "../file-editor/FileTab.jsx";
import { DiffPanel } from "../diff-view/DiffPanel.jsx";
import { DiffTab } from "../diff-view/DiffTab.jsx";
import { TerminalTab } from "../terminal/TerminalTab.jsx";
import { nextShellName } from "../terminal/next-shell-name.js";
import { useSessionWorkspace } from "../session-workspace/use-session-workspace.js";
import { WorkspaceDialogs } from "../session-workspace/WorkspaceDialogs.jsx";
import "./pane.css";
import "../file-tree/file-tree.css";

// xterm stays out of the first workspace chunk; the dock loads the terminal when a shell's tab first renders.
const TerminalDockPanel = lazy(() => import("../terminal/TerminalDockPanel.jsx"));

/** Phone: the session's workspace as a full-screen overlay. A bar on top (directory sheet, new shell, `controls` = its
 * close button), the dock with one tab row (no drag or split), the directory as a sheet over it. The desktop shows the
 * same tabs in its stage grid (shell/stage). */
export default function WorkspacePane({ api, sessionId, target, cwd, hidden, controls, place, refreshKey, terminalEnabled, onEditorOpen, diffRequest, onDiffServed, terminalRequest, onTerminalServed, onQuote }) {
  const [engine, setEngine] = useState(null);
  const [activePath, setActivePath] = useState(null);
  const [hasTabs, setHasTabs] = useState(false);
  const { treeOpen, resets } = useLayout();
  // The overlay opens on the directory sheet, unless a terminal can open (then its tab is what shows).
  const [sheet, setSheet] = useState(!terminalEnabled);
  const resetsSeen = useRef(resets);
  const work = useSessionWorkspace({ api, sessionId, target, engine, place, terminalEnabled, hidden, refreshKey, terminalRequest, onTerminalServed, onQuote, onShown: () => setSheet(false) });
  const { store, metadata } = work;

  const onReady = useCallback((created) => {
    const key = editorLayoutKey(sessionId);
    const raw = window.localStorage.getItem(key);
    store.markRestored(raw ? created.restore(raw) : []);
    setActivePath(created.activePath());
    setHasTabs(created.count() > 0);
    created.listen();
    created.onChange((json) => {
      setHasTabs(Boolean(json));
      if (json) window.localStorage.setItem(key, json); else window.localStorage.removeItem(key);
    });
    created.onActivePath(setActivePath);
    created.onPanelRemoved((path) => { if (path) store.forget(path); });
    setEngine(created);
  }, [store, sessionId]);

  useEffect(() => { onEditorOpen?.(hasTabs); }, [hasTabs, onEditorOpen]);
  // A file clicked in the monitor card asks for its diff tab; the request is served once the editor exists, then cleared.
  useEffect(() => {
    if (!engine || !diffRequest || diffRequest.sessionId !== sessionId) return;
    engine.openDiff(diffRequest.path);
    setSheet(false);
    onDiffServed?.();
  }, [engine, diffRequest, sessionId, onDiffServed]);
  // The layout reset puts every open tab back into one group (nothing closes, unsaved text and shells stay).
  useEffect(() => {
    if (resets === resetsSeen.current) return;
    resetsSeen.current = resets;
    engine?.mergeGroups();
  }, [resets, engine]);

  const newTerminal = () => {
    engine?.openTerminal(nextShellName([...engine.terminalNames(), ...Object.keys(metadata)]), true);
    setSheet(false);
  };
  const openFile = (entry) => {
    engine?.openFile(entry.path);
    setSheet(false);
  };

  return <section className="pi-workspace-pane" id="workspace-pane" hidden={hidden} data-compact="true" data-tree={treeOpen ? "open" : "closed"} data-editor={hasTabs ? "open" : "closed"} aria-label="工作区">
    <header className="pi-pane-bar">
      <Tooltip label="目录"><ActionIcon id="toggle-tree" variant={sheet ? "light" : "subtle"} color="gray" aria-label="目录" aria-pressed={sheet} onClick={() => setSheet((value) => !value)}><IconFolder size={17} /></ActionIcon></Tooltip>
      {terminalEnabled ? <Tooltip label="新终端"><ActionIcon id="new-terminal" variant="subtle" color="gray" aria-label="新终端" onClick={newTerminal}><IconTerminal2 size={17} /></ActionIcon></Tooltip> : null}
      <span className="pi-files-head-gap" />
      <div className="pi-pane-controls">{controls}</div>
    </header>
    <div className="pi-pane-body">
      <EditorContext.Provider value={work.editor}>
        <TerminalContext.Provider value={work.terminal}>
          <div className="pi-editor" id="editor-area">
            <EditorDock FilePanel={FilePanel} FileTab={FileTab} DiffPanel={DiffPanel} DiffTab={DiffTab} TerminalPanel={TerminalDockPanel} TerminalTab={TerminalTab} onReady={onReady} />
          </div>
        </TerminalContext.Provider>
      </EditorContext.Provider>
      <aside className="pi-tree is-sheet" id="file-tree" hidden={!(sheet || !hasTabs)}>
        <FileTree api={api} sessionId={sessionId} target={target} environment={`${target}\n${cwd}`} activePath={activePath}
          onOpenFile={openFile}
          onMoved={(from, to) => { store.remap(from, to); engine?.renamePaths(from, to); }}
          onDeleted={(path) => { store.drop(path); engine?.closePaths(path); }}
          onOverwritten={(paths) => store.reloadOpen(paths)}
          hasUnsaved={(path) => store.dirtyUnder(path)}
          pinned={false} onTogglePin={null} onCollapse={null} />
      </aside>
    </div>
    <WorkspaceDialogs work={work} engine={engine} />
  </section>;
}
