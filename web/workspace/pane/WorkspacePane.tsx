import type { ReactNode } from "react";
import type { PageApi } from "../../shell/page/page-types.ts";
import type { Engine } from "../editor-dock/engine/engine-types.ts";
import type { DirEntry } from "../file-paths/path-types.ts";
import type { DiffRequest, TerminalRequest } from "../session-workspace/workspace-types.ts";
import { Box, Group } from "@mantine/core";
import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useEffect } from "react";
import { lazy } from "react";
import { useLayout } from "../../shell/layout/use-layout.ts";
import { editorLayoutKey } from "../editor-layout/editor-layout-key.ts";
import FileTree from "../file-tree/FileTree.tsx";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconFolder } from "@tabler/icons-react";
import { IconTerminal2 } from "@tabler/icons-react";
import { EditorContext } from "../file-editor/editor-context.ts";
import { TerminalContext } from "../terminal/terminal-context.ts";
import { EditorDock } from "../editor-dock/EditorDock.tsx";
import { FilePanel } from "../file-editor/FilePanel.tsx";
import { FileTab } from "../file-editor/FileTab.tsx";
import { DiffPanel } from "../diff-view/DiffPanel.tsx";
import { DiffTab } from "../diff-view/DiffTab.tsx";
import { TerminalTab } from "../terminal/TerminalTab.tsx";
import { nextShellName } from "../terminal/next-shell-name.ts";
import { DebugToolsMenu } from "../debug-tools/DebugToolsMenu.tsx";
import { useSessionWorkspace } from "../session-workspace/use-session-workspace.ts";
import { WorkspaceDialogs } from "../session-workspace/WorkspaceDialogs.tsx";
import "./pane.css";
import "../file-tree/file-tree.css";

// xterm stays out of the first workspace chunk; the dock loads the terminal when a shell's tab first renders.
const TerminalDockPanel = lazy(() => import("../terminal/TerminalDockPanel.tsx"));

type WorkspacePaneProps = {
  api: PageApi; sessionId: string; target: string; cwd: string; hidden: boolean; controls: ReactNode; place: string; refreshKey: string; terminalEnabled: boolean;
  onEditorOpen: (open: boolean) => void; diffRequest: DiffRequest | null; onDiffServed: () => void; terminalRequest: TerminalRequest | null; onTerminalServed: () => void; onQuote: (text: string) => void;
};

/** Phone: the session's workspace as a full-screen overlay. A bar on top (directory sheet, new shell, `controls` = its
 * close button), the dock with one tab row (no drag or split), the directory as a sheet over it. The desktop shows the
 * same tabs in its stage grid (shell/stage). */
export default function WorkspacePane({ api, sessionId, target, cwd, hidden, controls, place, refreshKey, terminalEnabled, onEditorOpen, diffRequest, onDiffServed, terminalRequest, onTerminalServed, onQuote }: WorkspacePaneProps) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [hasTabs, setHasTabs] = useState(false);
  const { treeOpen, resets } = useLayout();
  // The overlay opens on the directory sheet, unless a terminal can open (then its tab is what shows).
  const [sheet, setSheet] = useState(!terminalEnabled);
  const resetsSeen = useRef(resets);
  const work = useSessionWorkspace({ api, sessionId, target, engine, place, terminalEnabled, hidden, refreshKey, terminalRequest, onTerminalServed, onQuote, onShown: () => setSheet(false) });
  const { store, metadata } = work;

  const onReady = useCallback((created: Engine) => {
    const key = editorLayoutKey(sessionId);
    const raw = window.localStorage.getItem(key);
    store.markRestored(raw ? created.restore(raw) : []);
    setActivePath(created.activePath());
    setHasTabs(created.count() > 0);
    created.listen();
    created.onChange((json: string | null) => {
      setHasTabs(Boolean(json));
      if (json) window.localStorage.setItem(key, json); else window.localStorage.removeItem(key);
    });
    created.onActivePath(setActivePath);
    created.onPanelRemoved((path: string | null) => { if (path) store.forget(path); });
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
  const openFile = (entry: DirEntry) => {
    engine?.openFile(entry.path);
    setSheet(false);
  };

  return <section className="pi-workspace-pane" id="workspace-pane" hidden={hidden} data-compact="true" data-tree={treeOpen ? "open" : "closed"} data-editor={hasTabs ? "open" : "closed"} aria-label="工作区">
    <Group component="header" className="pi-pane-bar" gap={5} wrap="nowrap" h="2.6rem" px="0.5rem">
      <Tooltip label="目录"><ActionIcon id="toggle-tree" size={26} variant={sheet ? "light" : "subtle"} color="gray" aria-label="目录" aria-pressed={sheet} onClick={() => setSheet((value) => !value)}><IconFolder size={17} /></ActionIcon></Tooltip>
      {terminalEnabled ? <Tooltip label="新终端"><ActionIcon id="new-terminal" size={26} variant="subtle" color="gray" aria-label="新终端" onClick={newTerminal}><IconTerminal2 size={17} /></ActionIcon></Tooltip> : null}
      <DebugToolsMenu engine={engine} onOpened={() => setSheet(false)} />
      <Box flex={1} />
      <Group gap={2} wrap="nowrap" className="pi-pane-controls">{controls}</Group>
    </Group>
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
