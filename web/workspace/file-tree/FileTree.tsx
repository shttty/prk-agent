import type { MouseEvent, ReactNode } from "react";
import type { PageApi } from "../../shell/page/page-types.ts";
import type { DirEntry } from "../file-paths/path-types.ts";
import type { ApiFailure } from "../file-store/file-store-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import type { Clashes, Clip, Editing, FileMenuState, Removing, TreeContextValue, TreeNode, UploadDestination, UploadProgress } from "./tree-types.ts";
import type { FileActionId } from "../file-actions/file-action-types.ts";
import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useLayoutEffect } from "react";
import { sortEntries } from "../file-paths/sort-entries.ts";
import { useMediaQuery } from "@mantine/hooks";
import { isDir } from "../file-paths/is-dir.ts";
import { parentOf } from "../file-paths/parent-of.ts";
import { failure } from "./failure.ts";
import { within } from "../file-paths/within.ts";
import { PathBar } from "./PathBar.tsx";
import { pathItems } from "../file-paths/path-items.ts";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Progress } from "@mantine/core";
import { Modal } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Box } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { IconChevronsRight } from "@tabler/icons-react";
import { IconPin } from "@tabler/icons-react";
import { IconPinFilled } from "@tabler/icons-react";
import { IconSearch } from "@tabler/icons-react";
import { IconX } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { TreeContext } from "./tree-context.ts";
import { DirectoryList } from "./DirectoryList.tsx";
import { FileMenu } from "../file-actions/FileMenu.tsx";
import { fileActionGroups } from "../file-actions/file-action-groups.ts";
import { baseName } from "../file-paths/base-name.ts";
import { useFileOperations } from "./use-file-operations.ts";
import "./file-tree.css";
import { isTargetMismatch } from "../file-store/target-mismatch.ts";
import { TARGET_MISMATCH_NOTICE } from "../file-store/target-mismatch.ts";
type ListReply = { path: string; entries: DirEntry[]; truncated?: boolean };

type FileTreeProps = {
  api: PageApi; sessionId: string; target: string; environment: string; activePath: string | null;
  onOpenFile: (entry: DirEntry) => void; onMoved: (from: string, to: string) => void; onDeleted: (path: string) => void;
  onOverwritten: (paths: string[]) => void; hasUnsaved: (path: string) => boolean; pinned: boolean;
  onTogglePin: (() => void) | null; onCollapse: ((event: MouseEvent<HTMLElement>) => void) | null; controls?: ReactNode;
};

const listFailure = (error: ApiFailure) => (isTargetMismatch(error) ? TARGET_MISMATCH_NOTICE : error.message);
export default function FileTree({ api, sessionId, target, environment, activePath, onOpenFile, onMoved, onDeleted, onOverwritten, hasUnsaved, pinned, onTogglePin, onCollapse, controls }: FileTreeProps) {
  const base = `/sessions/${encodeURIComponent(sessionId)}/files`;
  const [root, setRoot] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Record<string, TreeNode>>({});
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);

  const list = useCallback(async (path: string | null) => {
    // A listing answered after the environment changed belongs to the old one: it must not land in the new tree.
    const serial = generation.current;
    // Cached listings stay on screen while they refresh.
    if (path !== null) setNodes((current) => ({ ...current, [path]: { ...(current[path] || {}), loading: true, error: "" } }));
    try {
      const result: ListReply = await api.post(`${base}/list`, path === null ? { target } : { target, path });
      if (serial !== generation.current) return result.path;
      const key = path === null ? result.path : path;
      setNodes((current) => ({ ...current, [key]: { open: true, loading: false, error: "", entries: sortEntries(result.entries), truncated: result.truncated === true } }));
      return result.path;
    } catch (error) {
      if (path !== null && serial === generation.current) setNodes((current) => ({ ...current, [path]: { ...(current[path] || {}), loading: false, error: listFailure(toFailure(error)) } }));
      throw error;
    }
  }, [api, base, target]);

  // The first listing omits the path: the Gateway lists the saved cwd, which is only where the session starts.
  // A new target or cwd (same session) starts the tree over and drops everything that referred to the old one.
  const [rootError, setRootError] = useState("");
  useLayoutEffect(() => {
    const serial = ++generation.current;
    setRoot(null); setNodes({}); setRootError("");
    setMenu(null); setEditing(null); setClip(null); setRemoving(null); setClashes(null); setQuery(""); setOpError(""); setUploadProgress(null);
    void list(null).then((path) => { if (serial === generation.current) setRoot(path); })
      .catch((error) => { if (serial === generation.current) setRootError(listFailure(toFailure(error))); });
  }, [list, environment]);

  const goTo = (path: string) => { setRoot(path); setEditing(null); setQuery(""); void list(path).catch(() => {}); };
  const openSearch = () => { setSearchOpen(true); setTimeout(() => searchInput.current?.focus(), 0); };
  const closeSearch = () => { setSearchOpen(false); setQuery(""); };
  const refresh = () => { if (root !== null) void list(root).catch(() => {}); };

  // ── file operations ──
  const [menu, setMenu] = useState<FileMenuState | null>(null);
  const [showHidden, setShowHidden] = useState(() => { try { return localStorage.getItem("pi.files.showHidden") === "1"; } catch { return false; } });
  const toggleHidden = (value: boolean) => {
    setShowHidden(value);
    try { localStorage.setItem("pi.files.showHidden", value ? "1" : "0"); } catch { /* private mode */ }
  };
  const [editing, setEditing] = useState<Editing | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const [removing, setRemoving] = useState<Removing | null>(null);
  const [clashes, setClashes] = useState<Clashes | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [opError, setOpError] = useState("");
  const touch = useMediaQuery("(hover: none)");
  const uploadInput = useRef<HTMLInputElement>(null);
  const uploadDir = useRef<UploadDestination | null>(null);

  const dirFor = (entry: DirEntry | null) => (!entry ? root ?? "/" : isDir(entry) ? entry.path : parentOf(entry.path));
  const reload = (...dirs: string[]) => { for (const dir of new Set(dirs)) if (dir === root || nodes[dir]?.entries) void list(dir).catch(() => {}); };
  const attempt = async (operation: () => Promise<void>) => {
    const serial = generation.current;
    setOpError("");
    try { await operation(); } catch (error) { if (serial === generation.current) setOpError(failure(toFailure(error))); }
  };
  /** Cached listings under a renamed/moved/deleted path are stale. */
  const forgetListings = (path: string) => setNodes((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !within(key, path))));

  const onMenu = (event: MouseEvent<HTMLElement>, entry: DirEntry | null) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ entry, x: event.clientX, y: event.clientY, sheet: touch || (event.nativeEvent instanceof PointerEvent && event.nativeEvent.pointerType === "touch") });
  };
  const onMore = (event: MouseEvent<HTMLElement>, entry: DirEntry | null) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ entry, x: rect.left, y: rect.bottom, sheet: touch });
  };

  const { act, commitName, confirmRemove, onUpload, overwrite } = useFileOperations({ attempt, generation, target, clip, api, base, forgetListings, onMoved, setClip, reload, menu, dirFor, setMenu, onOpenFile, root, goTo, setEditing, setOpError, refresh, setRemoving, editing, showHidden, toggleHidden, removing, onDeleted, uploadInput, uploadDir, setClashes, clashes, onOverwritten, uploadProgress, setUploadProgress });

  const tree: TreeContextValue = { showHidden, query, nodes, goTo, openFile: onOpenFile, activePath, editing, cutPath: clip?.mode === "cut" ? clip.entry.path : null, onMenu, onMore, commitName, cancelEdit: () => setEditing(null) };
  const removingDirty = removing ? hasUnsaved(removing.path) : false;

  return <nav className="pi-files" id="files-panel" aria-label="文件">
    <Group className="pi-files-top" gap={4} wrap="wrap" mih={36} pl={11} pr={6}>
      <Box className="pi-files-path" flex="1 1 80px" miw={80}>{root !== null ? <PathBar items={pathItems(root)} onGo={goTo} /> : null}</Box>
      <Group className="pi-files-top-actions" gap={2} wrap="nowrap" ml="auto">
        <Tooltip label="筛选文件"><ActionIcon id="files-search-toggle" size="sm" variant="subtle" color="gray" aria-label="筛选文件" aria-expanded={searchOpen} onClick={() => (searchOpen ? closeSearch() : openSearch())}><IconSearch size={14} /></ActionIcon></Tooltip>
        <Tooltip label="新建与目录操作"><ActionIcon id="files-new" size="sm" variant="subtle" color="gray" aria-label="新建" disabled={root === null} onClick={(event) => onMore(event, null)}><IconPlus size={14} /></ActionIcon></Tooltip>
        {onTogglePin ? <Tooltip label={pinned ? "取消固定" : "固定为侧栏"}><ActionIcon id="pin-tree" size="sm" variant="subtle" color="gray" aria-label={pinned ? "取消固定目录栏" : "固定目录栏"} aria-pressed={pinned} onClick={onTogglePin}>{pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}</ActionIcon></Tooltip> : null}
        {onCollapse ? <Tooltip label="收起目录栏"><ActionIcon id="collapse-tree" size="sm" variant="subtle" color="gray" aria-label="收起目录栏" onClick={onCollapse}><IconChevronsRight size={14} /></ActionIcon></Tooltip> : null}
      </Group>
      {controls ? <Box ml="auto">{controls}</Box> : null}
    </Group>
    {searchOpen ? <div className="pi-files-search-row">
      <div className="pi-files-search-box">
        <IconSearch size={13} className="pi-files-search-icon" aria-hidden="true" />
        <input ref={searchInput} id="files-filter" className="pi-files-filter" type="search" placeholder="筛选文件…" aria-label="筛选当前目录" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }} />
        <ActionIcon id="files-search-close" className="pi-files-search-close" size="xs" variant="subtle" color="gray" aria-label="关闭筛选" onClick={closeSearch}><IconX size={13} /></ActionIcon>
      </div>
    </div> : null}
    {opError ? <InlineAlert m="xs" flex="none" withCloseButton closeButtonLabel="关闭错误提示" onClose={() => setOpError("")}>{opError}</InlineAlert> : null}
    {uploadProgress ? <div id="file-upload-progress" data-transferred={uploadProgress.bytes} data-total={uploadProgress.size}>
      <Text size="xs" mx="xs" truncate>{uploadProgress.bytes < uploadProgress.size ? "正在上传" : "正在保存"}：{uploadProgress.name}</Text>
      <Progress m="xs" size="xs" aria-label={`上传 ${uploadProgress.name}`} value={uploadProgress.size ? 100 * uploadProgress.bytes / uploadProgress.size : 100} />
    </div> : null}
    <div className="pi-files-list" aria-label="目录内容" onContextMenu={(event) => { if (root !== null) onMenu(event, null); }}>
      {rootError ? <InlineAlert m="xs">{rootError}</InlineAlert> : root === null ? <div className="pi-files-note"><Loader size={12} /></div>
        : <TreeContext.Provider value={tree}><DirectoryList path={root} /></TreeContext.Provider>}
    </div>
    <input id="file-upload-input" ref={uploadInput} type="file" multiple hidden onChange={(event) => void onUpload(event)} />
    <FileMenu menu={menu} groups={fileActionGroups(menu?.entry ?? null, Boolean(clip))} showHidden={showHidden} onAction={(id: FileActionId) => act(id)} onClose={() => setMenu(null)} />
    <Modal opened={Boolean(removing)} onClose={() => setRemoving(null)} title={removing ? `删除 ${removing.name}？` : ""} size="sm" centered>
      {removing && isDir(removing) ? <Text size="sm">只能删除空目录。</Text> : null}
      {removingDirty ? <Text size="sm">有未保存的修改。</Text> : null}
      <Group justify="flex-end" gap="xs" mt="md">
        <Button variant="default" onClick={() => setRemoving(null)}>取消</Button>
        <Button id="confirm-file-delete" color="red" onClick={confirmRemove}>删除</Button>
      </Group>
    </Modal>
    <Modal opened={Boolean(clashes)} onClose={() => setClashes(null)} title="已有同名文件" size="sm" centered>
      <Text size="sm">{clashes?.items.map((item) => baseName(item.path)).join("、")}</Text>
      <Group justify="flex-end" gap="xs" mt="md">
        <Button variant="default" onClick={() => setClashes(null)}>跳过</Button>
        <Button id="confirm-file-overwrite" color="red" onClick={overwrite}>覆盖</Button>
      </Group>
    </Modal>
  </nav>;
}
