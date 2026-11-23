import { useContext } from "react";
import { TreeContext } from "./tree-context.js";
import { visibleEntries } from "../file-paths/visible-entries.js";
import { NameInput } from "../file-actions/NameInput.jsx";
import { IconFolder } from "@tabler/icons-react";
import { IconFile } from "@tabler/icons-react";
import { Loader } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { FileRow } from "./FileRow.jsx";
export function DirectoryList({ path }) {
  const { nodes, editing, commitName, cancelEdit, showHidden, query } = useContext(TreeContext);
  const node = nodes[path];
  const entries = visibleEntries(node?.entries, { showHidden, query });
  const creating = (editing?.kind === "file" || editing?.kind === "directory") && editing.dir === path
    ? <NameInput icon={editing.kind === "directory" ? IconFolder : IconFile} label={editing.kind === "directory" ? "新文件夹名" : "新文件名"} onCommit={commitName} onCancel={cancelEdit} />
    : null;
  if (!node || (node.loading && !node.entries)) return <div className="pi-files-note"><Loader size={12} /></div>;
  if (node.error) return <InlineAlert m="xs">{node.error}</InlineAlert>;
  const cut = node.truncated ? <div className="pi-files-note" data-state="truncated">目录过大，只列出部分条目。</div> : null;
  if (!entries.length && !creating) return <><div className="pi-files-note" data-state={query.trim() ? "no-match" : "empty"}>{query.trim() ? "没有匹配的文件" : node.entries.length ? "只有隐藏文件" : "空目录"}</div>{cut}</>;
  return <><ul>{creating ? <li>{creating}</li> : null}{entries.map((entry) => <FileRow key={entry.path} entry={entry} />)}</ul>{cut}</>;
}
