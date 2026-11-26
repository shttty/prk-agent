import type { ReactNode } from "react";
import type { PageApi } from "../page/page-types.ts";
import type { Engine } from "../../workspace/editor-dock/engine/engine-types.ts";
import type { FileStore } from "../../workspace/file-store/file-store-types.ts";
import FileTree from "../../workspace/file-tree/FileTree.tsx";
import { useSplitter } from "../layout/use-splitter.ts";
import { handFocus } from "../layout/hand-focus.ts";
import { layout } from "../layout/layout-store.ts";
import { clampTreeWidth } from "./clamp-tree-width.ts";
import { useDismissOutside } from "./use-dismiss-outside.ts";

const saveWidth = (value: number) => layout.set({ treeWidth: clampTreeWidth(value) });

type StageTreeProps = {
  api: PageApi; sessionId: string; target: string; cwd: string; shown: boolean; activePath: string | null; engine: Engine | null;
  store: FileStore; treeOpen: boolean; treePinned: boolean; treeWidth: number; controls: ReactNode;
};

/** The directory, outside the grid: 📁 shows it as a popover over the stage's right edge (a picked file closes it), 📌
 * pins it as a card column at the stage's right edge, its width set by its own handle (the chat gives up the room).
 * `shown`: the workspace is open; `treeWidth` is already clamped; `controls`: the stage's buttons, which a pinned
 * directory holds in its header (it owns the stage's top-right corner). */
export function StageTree({ api, sessionId, target, cwd, shown, activePath, engine, store, treeOpen, treePinned, treeWidth, controls }: StageTreeProps) {
  const visible = shown && treeOpen;
  useDismissOutside(visible && !treePinned, () => layout.set({ treeOpen: false }));
  const splitter = useSplitter("x", treeWidth, saveWidth, saveWidth, clampTreeWidth);
  return <>
    {/* Exception to native layout: the column's resize handle (a drag handle sits on the gap between two cards). */}
    {visible && treePinned ? <div className="pi-splitter is-x pi-stage-tree-splitter" aria-label="调整目录栏宽度" {...splitter} /> : null}
    <aside className="pi-tree" id="file-tree" data-mode={treePinned ? "pinned" : "popover"} hidden={!visible}>
      <FileTree api={api} sessionId={sessionId} target={target} environment={`${target}\n${cwd}`} activePath={activePath}
        onOpenFile={(entry) => { engine?.openFile(entry.path); if (!treePinned) layout.set({ treeOpen: false }); }}
        onMoved={(from, to) => { store.remap(from, to); engine?.renamePaths(from, to); }}
        onDeleted={(path) => { store.drop(path); engine?.closePaths(path); }}
        onOverwritten={(paths) => store.reloadOpen(paths)}
        hasUnsaved={(path) => store.dirtyUnder(path)}
        pinned={treePinned}
        onTogglePin={() => layout.set({ treePinned: !treePinned, treeOpen: true })}
        onCollapse={treePinned ? (event) => { layout.set({ treeOpen: false }); handFocus(event, "toggle-tree"); } : null}
        controls={controls} />
    </aside>
  </>;
}
