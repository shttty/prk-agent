import { useState } from "react";
import { text } from "../../sessions/sidebar/text.js";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import { Group } from "@mantine/core";
import { Switch } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { IconChevronUp } from "@tabler/icons-react";
import { IconSearch } from "@tabler/icons-react";
import { FormError } from "../../design-system/form-error/FormError.jsx";
import { PickerEntries } from "./PickerEntries.jsx";
import "./directory-picker.css";
/** Browses a target's file system by absolute path. `mode="file"` picks a file (directories still open), otherwise a directory. */
export function DirectoryPicker({ directory, onBrowse, onBack, onSelect, selectDisabled = false, mode = "directory" }) {
  const fileMode = mode === "file";
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const path = text(directory.path).trim();
  const parent = path.split("/").slice(0, -1).join("/") || "/";
  const navigationDisabled = Boolean(directory.loading);
  const selectionDisabled = navigationDisabled || Boolean(directory.error) || selectDisabled || !path;
  // The filter belongs to the listed directory; another directory starts unfiltered.
  const browse = (next) => { setQuery(""); onBrowse(next); };

  return (
    <div id="directory-picker" className="management-directory-picker" data-mode={mode}>
      <div className="management-directory-heading">
        <div className="management-directory-heading-copy">
          <Text fw={600}>{fileMode ? "选择 Python 解释器" : "选择工作目录"}</Text>
          <Text size="sm" c="dimmed">{fileMode ? "选目标机上的可执行文件，选定后会实际检查版本。" : "只能选文件夹。"}</Text>
        </div>
        <Button data-action="directory-back" variant="subtle" size="compact-sm" onClick={onBack}>返回编辑</Button>
      </div>
      <div className="management-directory-toolbar" role="toolbar" aria-label="目录导航">
        <Group gap="xs" wrap="nowrap" className="management-directory-toolbar-actions">
          <Button data-action="directory-up" variant="subtle" size="compact-sm" leftSection={<IconChevronUp size={16} aria-hidden="true" />} aria-label="返回上级目录" disabled={navigationDisabled || directory.atRoot || path === "/"} onClick={() => browse(parent)}>上一级</Button>
        </Group>
        <Text size="sm" c="dimmed" className="management-directory-path" data-path={path} data-at-root={String(Boolean(directory.atRoot))}>{path}</Text>
      </div>
      <div className="management-directory-filter">
        <TextInput id="directory-filter" className="management-directory-search" size="xs" type="search" leftSection={<IconSearch size={14} aria-hidden="true" />}
          placeholder="筛选当前目录" aria-label="筛选当前目录" autoComplete="off" spellCheck={false} value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          // Escape clears a filter instead of closing the dialog: Mantine's modal skips Escape from a target carrying this attribute.
          data-mantine-stop-propagation={query ? "true" : undefined}
          onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} />
        <Switch id="directory-hidden" size="xs" label="显示隐藏文件" checked={showHidden} onChange={(event) => setShowHidden(event.currentTarget.checked)} />
      </div>
      <FormError>{directory.error}</FormError>
      <div className="management-directory-list" aria-busy={navigationDisabled}>
        {directory.loading ? (
          <Text size="sm" c="dimmed" className="management-directory-state">正在读取目录…</Text>
        ) : directory.error ? null : (
          <PickerEntries entries={directory.entries} showHidden={showHidden} query={query} fileMode={fileMode} onOpen={browse} onPick={onSelect} />
        )}
      </div>
      {directory.truncated && !directory.loading && !directory.error ? <Text size="sm" c="dimmed" className="management-directory-state" data-state="truncated">目录过大，只列出部分条目。</Text> : null}
      <div className="management-directory-footer">
        <Button variant="default" onClick={onBack}>取消</Button>
        {fileMode ? null : <Button data-action="directory-select" disabled={selectionDisabled} onClick={() => onSelect(path)}>选择此目录</Button>}
      </div>
    </div>
  );
}
