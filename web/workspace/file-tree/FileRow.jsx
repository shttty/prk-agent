import { useContext } from "react";
import { TreeContext } from "./tree-context.js";
import { isDir } from "../file-paths/is-dir.js";
import { IconDots } from "@tabler/icons-react";
import { entryIcon } from "./entry-icon.js";
import { EntryRow } from "./EntryRow.jsx";
import { NameInput } from "../file-actions/NameInput.jsx";
import { within } from "../file-paths/within.js";
export function FileRow({ entry }) {
  const { goTo, openFile, activePath, editing, cutPath, onMenu, onMore, commitName, cancelEdit } = useContext(TreeContext);
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
