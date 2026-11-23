import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useLayoutEffect } from "react";
import { sortEntries } from "../file-paths/sort-entries.js";
import { useMediaQuery } from "@mantine/hooks";
import { isDir } from "../file-paths/is-dir.js";
import { parentOf } from "../file-paths/parent-of.js";
import { failure } from "./failure.js";
import { within } from "../file-paths/within.js";
import { PathBar } from "./PathBar.jsx";
import { pathItems } from "../file-paths/path-items.js";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Modal } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { IconChevronsRight } from "@tabler/icons-react";
import { IconPin } from "@tabler/icons-react";
import { IconPinFilled } from "@tabler/icons-react";
import { IconSearch } from "@tabler/icons-react";
import { IconX } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { TreeContext } from "./tree-context.js";
import { DirectoryList } from "./DirectoryList.jsx";
import { FileMenu } from "../file-actions/FileMenu.jsx";
import { fileActionGroups } from "../file-actions/file-action-groups.js";
import { baseName } from "../file-paths/base-name.js";
import { useFileOperations } from "./use-file-operations.js";
import "./file-tree.css";
import { isTargetMismatch } from "../file-store/target-mismatch.js";
import { TARGET_MISMATCH_NOTICE } from "../file-store/target-mismatch.js";
const listFailure = (error) => (isTargetMismatch(error) ? TARGET_MISMATCH_NOTICE : error.message);
export default function FileTree({ api, sessionId, target, environment, activePath, onOpenFile, onMoved, onDeleted, onOverwritten, hasUnsaved, pinned, onTogglePin, onCollapse }) {
  const base = `/sessions/${encodeURIComponent(sessionId)}/files`;
  const [root, setRoot] = useState(null);
  const [nodes, setNodes] = useState({});
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef(null);
  const generation = useRef(0);

  const list = useCallback(async (path) => {
    // A listing answered after the environment changed belongs to the old one: it must not land in the new tree.
    const serial = generation.current;
    // Cached listings stay on screen while they refresh.
    if (path !== null) setNodes((current) => ({ ...current, [path]: { ...(current[path] || {}), loading: true, error: "" } }));
    try {
      const result = await api.post(`${base}/list`, path === null ? { target } : { target, path });
      if (serial !== generation.current) return result.path;
      const key = path === null ? result.path : path;
      setNodes((current) => ({ ...current, [key]: { open: true, loading: false, error: "", entries: sortEntries(result.entries), truncated: result.truncated === true } }));
      return result.path;
    } catch (error) {
      if (path !== null && serial === generation.current) setNodes((current) => ({ ...current, [path]: { ...(current[path] || {}), loading: false, error: listFailure(error) } }));
      throw error;
    }
  }, [api, base, target]);

  // The first listing omits the path: the Gateway lists the saved cwd, which is only where the session starts.
  // A new target or cwd (same session) starts the tree over and drops everything that referred to the old one.
  const [rootError, setRootError] = useState("");
  useLayoutEffect(() => {
    const serial = ++generation.current;
    setRoot(null); setNodes({}); setRootError("");
    setMenu(null); setEditing(null); setClip(null); setRemoving(null); setClashes(null); setQuery(""); setOpError("");
    void list(null).then((path) => { if (serial === generation.current) setRoot(path); })
      .catch((error) => { if (serial === generation.current) setRootError(listFailure(error)); });
  }, [list, environment]);

  const goTo = (path) => { setRoot(path); setEditing(null); setQuery(""); void list(path).catch(() => {}); };
  const openSearch = () => { setSearchOpen(true); setTimeout(() => searchInput.current?.focus(), 0); };
  const closeSearch = () => { setSearchOpen(false); setQuery(""); };
  const refresh = () => { if (root !== null) void list(root).catch(() => {}); };

  // ── file operations ──
  const [menu, setMenu] = useState(null);
  const [showHidden, setShowHidden] = useState(() => { try { return localStorage.getItem("pi.files.showHidden") === "1"; } catch { return false; } });
  const toggleHidden = (value) => {
    setShowHidden(value);
    try { localStorage.setItem("pi.files.showHidden", value ? "1" : "0"); } catch { /* private mode */ }
  };
  const [editing, setEditing] = useState(null);
  const [clip, setClip] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [clashes, setClashes] = useState(null);
  const [opError, setOpError] = useState("");
  const touch = useMediaQuery("(hover: none)");
  const uploadInput = useRef(null);
  const uploadDir = useRef(null);

  const dirFor = (entry) => (!entry ? root : isDir(entry) ? entry.path : parentOf(entry.path));
  const reload = (...dirs) => { for (const dir of new Set(dirs)) if (dir === root || nodes[dir]?.entries) void list(dir).catch(() => {}); };
  const attempt = async (operation) => {
    const serial = generation.current;
    setOpError("");
    try { await operation(); } catch (error) { if (serial === generation.current) setOpError(failure(error)); }
  };
  /** Cached listings under a renamed/moved/deleted path are stale. */
  const forgetListings = (path) => setNodes((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !within(key, path))));

  const onMenu = (event, entry) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ entry, x: event.clientX, y: event.clientY, sheet: touch || event.nativeEvent?.pointerType === "touch" });
  };
  const onMore = (event, entry) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ entry, x: rect.left, y: rect.bottom, sheet: touch });
  };

  const { act, commitName, confirmRemove, onUpload, overwrite } = useFileOperations({ attempt, generation, target, clip, api, base, forgetListings, onMoved, setClip, reload, menu, dirFor, setMenu, onOpenFile, root, goTo, setEditing, setOpError, refresh, setRemoving, editing, showHidden, toggleHidden, removing, onDeleted, uploadInput, uploadDir, setClashes, clashes, onOverwritten });

  const tree = { showHidden, query, nodes, goTo, openFile: onOpenFile, activePath, editing, cutPath: clip?.mode === "cut" ? clip.entry.path : null, onMenu, onMore, commitName, cancelEdit: () => setEditing(null) };
  const removingDirty = removing ? hasUnsaved(removing.path) : false;

  return <nav className="pi-files" id="files-panel" aria-label="文件">
    <div className="pi-files-top">
      <div className="pi-files-path">{root !== null ? <PathBar items={pathItems(root)} onGo={goTo} /> : null}</div>
      <div className="pi-files-top-actions">
        <Tooltip label="筛选文件"><ActionIcon id="files-search-toggle" size="sm" variant="subtle" color="gray" aria-label="筛选文件" aria-expanded={searchOpen} onClick={() => (searchOpen ? closeSearch() : openSearch())}><IconSearch size={14} /></ActionIcon></Tooltip>
        <Tooltip label="新建与目录操作"><ActionIcon id="files-new" size="sm" variant="subtle" color="gray" aria-label="新建" disabled={root === null} onClick={(event) => onMore(event, null)}><IconPlus size={14} /></ActionIcon></Tooltip>
        {onTogglePin ? <Tooltip label={pinned ? "取消固定" : "固定为侧栏"}><ActionIcon id="pin-tree" size="sm" variant="subtle" color="gray" aria-label={pinned ? "取消固定目录栏" : "固定目录栏"} aria-pressed={pinned} onClick={onTogglePin}>{pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}</ActionIcon></Tooltip> : null}
        {onCollapse ? <Tooltip label="收起目录栏"><ActionIcon id="collapse-tree" size="sm" variant="subtle" color="gray" aria-label="收起目录栏" onClick={onCollapse}><IconChevronsRight size={14} /></ActionIcon></Tooltip> : null}
      </div>
    </div>
    {searchOpen ? <div className="pi-files-search-row">
      <div className="pi-files-search-box">
        <IconSearch size={13} className="pi-files-search-icon" aria-hidden="true" />
        <input ref={searchInput} id="files-filter" className="pi-files-filter" type="search" placeholder="筛选文件…" aria-label="筛选当前目录" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }} />
        <ActionIcon id="files-search-close" className="pi-files-search-close" size="xs" variant="subtle" color="gray" aria-label="关闭筛选" onClick={closeSearch}><IconX size={13} /></ActionIcon>
      </div>
    </div> : null}
    {opError ? <InlineAlert m="xs" flex="none" withCloseButton closeButtonLabel="关闭错误提示" onClose={() => setOpError("")}>{opError}</InlineAlert> : null}
    <div className="pi-files-list" aria-label="目录内容" onContextMenu={(event) => { if (root !== null) onMenu(event, null); }}>
      {rootError ? <InlineAlert m="xs">{rootError}</InlineAlert> : root === null ? <div className="pi-files-note"><Loader size={12} /></div>
        : <TreeContext.Provider value={tree}><DirectoryList path={root} /></TreeContext.Provider>}
    </div>
    <input ref={uploadInput} type="file" multiple hidden onChange={(event) => void onUpload(event)} />
    <FileMenu menu={menu} groups={fileActionGroups(menu?.entry ?? null, Boolean(clip))} showHidden={showHidden} onAction={act} onClose={() => setMenu(null)} />
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
