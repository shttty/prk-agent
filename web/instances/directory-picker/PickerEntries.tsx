import { Center, Text } from "@mantine/core";
import type { AbsoluteListing } from "../../../src/gateway/wire/web-types.ts";
import { visibleEntries } from "../../workspace/file-paths/visible-entries.js";
import { sortEntries } from "../../workspace/file-paths/sort-entries.js";
import { isDir } from "../../workspace/file-paths/is-dir.js";
import { EntryRow } from "../../workspace/file-tree/EntryRow.jsx";

const EMPTY_TEXT: Record<string, string> = { empty: "此目录为空。", "hidden-only": "只有隐藏文件。", "no-match": "没有匹配的条目。" };

type PickerEntriesProps = { entries: AbsoluteListing["entries"]; showHidden: boolean; query: string; fileMode: boolean; onOpen: (path: string) => void; onPick: (path: string) => void };

/** The listed directory after the hidden-file switch and the name filter. Folders open; files are picked in file mode, inert otherwise. */
export function PickerEntries({ entries, showHidden, query, fileMode, onOpen, onPick }: PickerEntriesProps) {
  const shown: AbsoluteListing["entries"] = sortEntries(visibleEntries(entries, { showHidden, query }));
  if (!shown.length) {
    const state = !entries.length ? "empty" : query.trim() ? "no-match" : "hidden-only";
    return <Center mih={94} p="md" data-state={state}><Text size="sm" c="dimmed" ta="center">{EMPTY_TEXT[state]}</Text></Center>;
  }
  return <ul className="management-directory-entries" aria-label="目录内容">
    {shown.map((entry) => <li key={entry.path}>
      {isDir(entry)
        ? <EntryRow entry={entry} data-action="directory-open" data-path={entry.path} aria-label={`打开文件夹 ${entry.name}`} onClick={() => onOpen(entry.path)} />
        : fileMode
          ? <EntryRow entry={entry} data-action="file-select" data-path={entry.path} aria-label={`选择文件 ${entry.name}`} onClick={() => onPick(entry.path)} />
          : <EntryRow entry={entry} data-path={entry.path} disabled onClick={undefined} />}
    </li>)}
  </ul>;
}
