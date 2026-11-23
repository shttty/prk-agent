import { isDir } from "../file-paths/is-dir.js";
import { entryIcon } from "./entry-icon.js";
import "./entry-row.css";
/** One file or folder row: type icon, name, current-file highlight. Extra button attributes (data-*, aria-label, disabled) pass through. */
export function EntryRow({ entry, active = false, onClick, ...button }) {
  const Icon = entryIcon(entry);
  return <button type="button" {...button} className={`pi-files-row${active ? " is-active" : ""}`} title={entry.path} onClick={onClick}>
    <Icon size={15} stroke={1.6} aria-hidden="true" className={isDir(entry) ? "pi-files-icon is-dir" : "pi-files-icon"} />
    <span className="pi-files-name">{entry.name}</span>
  </button>;
}
