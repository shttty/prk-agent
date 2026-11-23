import FileTree from "../../workspace/file-tree/FileTree.jsx";
import { useSplitter } from "../layout/use-splitter.js";
import { handFocus } from "../layout/hand-focus.js";
import { layout } from "../layout/layout-store.js";
import { clampTreeWidth } from "./clamp-tree-width.js";
import { usePopoverDismiss } from "./use-popover-dismiss.js";

const saveWidth = (value) => layout.set({ treeWidth: clampTreeWidth(value) });

/** The directory, outside the grid: 📁 shows it as a popover over the stage's right edge (a picked file closes it), 📌
 * pins it as a card column at the stage's right edge, its width set by its own handle (the chat gives up the room).
 * `shown`: the workspace is open; `treeWidth` is already clamped. */
export function StageTree({ api, sessionId, target, cwd, shown, activePath, engine, store, treeOpen, treePinned, treeWidth }) {
  const visible = shown && treeOpen;
  usePopoverDismiss(visible && !treePinned, () => layout.set({ treeOpen: false }));
  const splitter = useSplitter("x", treeWidth, saveWidth, saveWidth, clampTreeWidth);
  return <>
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
        onCollapse={treePinned ? (event) => { layout.set({ treeOpen: false }); handFocus(event, "toggle-tree"); } : null} />
    </aside>
  </>;
}
