import { useState } from "react";
import { Button, Center, Flex, Group, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconChevronUp, IconSearch } from "@tabler/icons-react";
import { FormError } from "../../design-system/form-error/FormError.tsx";
import { PickerEntries } from "./PickerEntries.tsx";
import type { DirectoryState } from "./directory-types.ts";
import "./directory-picker.css";

type DirectoryPickerProps = {
  directory: DirectoryState;
  onBrowse: (path: string) => void | Promise<void>;
  onBack: () => void;
  onSelect: (path: string) => void;
  selectDisabled?: boolean;
  mode?: "directory" | "file";
};

/** Browses a target's file system by absolute path. `mode="file"` picks a file (directories still open), otherwise a directory. */
export function DirectoryPicker({ directory, onBrowse, onBack, onSelect, selectDisabled = false, mode = "directory" }: DirectoryPickerProps) {
  const fileMode = mode === "file";
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const path = directory.path.trim();
  const parent = path.split("/").slice(0, -1).join("/") || "/";
  const navigationDisabled = directory.loading;
  const selectionDisabled = navigationDisabled || Boolean(directory.error) || selectDisabled || !path;
  // The filter belongs to the listed directory; another directory starts unfiltered.
  const browse = (next: string) => { setQuery(""); void onBrowse(next); };

  return (
    <Stack id="directory-picker" gap={10} className="management-directory-picker" data-mode={mode}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap={10}>
        <div>
          <Text fw={600}>{fileMode ? "选择 Python 解释器" : "选择工作目录"}</Text>
          <Text size="sm" c="dimmed">{fileMode ? "选目标机上的可执行文件，选定后会实际检查版本。" : "只能选文件夹。"}</Text>
        </div>
        <Button data-action="directory-back" variant="subtle" size="compact-sm" onClick={onBack}>返回编辑</Button>
      </Group>
      <Flex direction={{ base: "column", sm: "row" }} align={{ base: "flex-start", sm: "center" }} justify="space-between" gap={8} role="toolbar" aria-label="目录导航">
        <Button data-action="directory-up" variant="subtle" size="compact-sm" leftSection={<IconChevronUp size={16} aria-hidden="true" />} aria-label="返回上级目录" disabled={navigationDisabled || directory.atRoot || path === "/"} onClick={() => browse(parent)}>上一级</Button>
        <Text size="sm" c="dimmed" truncate="end" ta={{ base: "left", sm: "right" }} w={{ base: "100%", sm: "auto" }} flex={{ sm: "1 1 auto" }} className="management-directory-path" data-path={path} data-at-root={String(directory.atRoot)}>{path}</Text>
      </Flex>
      <Group wrap="nowrap" gap={12}>
        <TextInput id="directory-filter" flex={1} size="xs" type="search" leftSection={<IconSearch size={14} aria-hidden="true" />}
          placeholder="筛选当前目录" aria-label="筛选当前目录" autoComplete="off" spellCheck={false} value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          // Escape clears a filter instead of closing the dialog: Mantine's modal skips Escape from a target carrying this attribute.
          data-mantine-stop-propagation={query ? "true" : undefined}
          onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} />
        <Switch id="directory-hidden" size="xs" label="显示隐藏文件" checked={showHidden} onChange={(event) => setShowHidden(event.currentTarget.checked)} />
      </Group>
      <FormError>{directory.error}</FormError>
      <div className="management-directory-list" aria-busy={navigationDisabled}>
        {directory.loading ? (
          <Center mih={94} p="md"><Text size="sm" c="dimmed" ta="center">正在读取目录…</Text></Center>
        ) : directory.error ? null : (
          <PickerEntries entries={directory.entries} showHidden={showHidden} query={query} fileMode={fileMode} onOpen={browse} onPick={onSelect} />
        )}
      </div>
      {directory.truncated && !directory.loading && !directory.error ? <Center mih={94} p="md" data-state="truncated"><Text size="sm" c="dimmed" ta="center">目录过大，只列出部分条目。</Text></Center> : null}
      <Group justify="flex-end" gap={8} className="management-directory-footer">
        <Button variant="default" onClick={onBack}>取消</Button>
        {fileMode ? null : <Button data-action="directory-select" disabled={selectionDisabled} onClick={() => onSelect(path)}>选择此目录</Button>}
      </Group>
    </Stack>
  );
}
