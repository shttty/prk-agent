import type { DirEntry } from "../file-paths/path-types.ts";
import { useTreeContext } from "./use-tree-context.ts";
import { isDir } from "../file-paths/is-dir.ts";
import { IconDots } from "@tabler/icons-react";
import { entryIcon } from "./entry-icon.ts";
import { EntryRow } from "./EntryRow.tsx";
import { NameInput } from "../file-actions/NameInput.tsx";
import { within } from "../file-paths/within.ts";
export function FileRow({ entry }: { entry: DirEntry }) {
  const { goTo, openFile, activePath, editing, cutPath, onMenu, onMore, commitName, cancelEdit } = useTreeContext();
  const dir = isDir(entry);
  const active = !dir && entry.path === activePath;
  const renaming = editing?.kind === "rename" && editing.entry.path === entry.path;
  return <li data-path={entry.path} data-type={dir ? "directory" : "file"} aria-current={active ? "true" : undefined}>
    {renaming
      ? <NameInput initial={entry.name} icon={entryIcon(entry)} label={`重命名 ${entry.name}`} onCommit={commitName} onCancel={cancelEdit} />
      : <div className={`pi-files-line${cutPath && within(entry.path, cutPath) ? " is-cut" : ""}`} onContextMenu={(event) => onMenu(event, entry)}>
        <EntryRow entry={entry} active={active} onClick={() => (dir ? goTo(entry.path) : openFile(entry))} />
        <button type="button" className="pi-files-more" aria-label={`${entry.name} 的操作`} onClick={(event) => onMore(event, entry)}><IconDots size={14} /></button>
      </div>}
  </li>;
}
