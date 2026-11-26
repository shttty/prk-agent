import type { Dispatch, RefObject, SetStateAction, ChangeEvent } from "react";
import type { PageApi } from "../../shell/page/page-types.ts";
import type { DirEntry } from "../file-paths/path-types.ts";
import type { FileActionId } from "../file-actions/file-action-types.ts";
import type { Clashes, Clip, Editing, FileMenuState, Removing, UploadDestination, UploadProgress } from "./tree-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { isDir } from "../file-paths/is-dir.ts";
import { within } from "../file-paths/within.ts";
import { joinPath } from "../file-paths/join-path.ts";
import { parentOf } from "../file-paths/parent-of.ts";
import { copyText } from "../file-actions/copy-text.ts";
import { downloadFile } from "../file-actions/download-file.ts";
import { uploadFile } from "../file-actions/upload-file.ts";
import { failure } from "./failure.ts";
import { isTargetMismatch } from "../file-store/target-mismatch.ts";
// Every request names the target its intent belongs to (`target`): the menu click, the clipboard, the name input, the delete
// prompt and the upload's clash list each remember it, so nothing is re-targeted after a transfer or a confirmation.
type State<T> = Dispatch<SetStateAction<T>>;

type FileOperationsOptions = {
  attempt: (operation: () => Promise<void>) => Promise<void>;
  generation: RefObject<number>;
  target: string;
  clip: Clip | null;
  api: PageApi;
  base: string;
  forgetListings: (path: string) => void;
  onMoved: (from: string, to: string) => void;
  setClip: State<Clip | null>;
  reload: (...dirs: string[]) => void;
  menu: FileMenuState | null;
  dirFor: (entry: DirEntry | null) => string;
  setMenu: State<FileMenuState | null>;
  onOpenFile: (entry: DirEntry) => void;
  root: string | null;
  goTo: (path: string) => void;
  setEditing: State<Editing | null>;
  setOpError: State<string>;
  refresh: () => void;
  setRemoving: State<Removing | null>;
  editing: Editing | null;
  showHidden: boolean;
  toggleHidden: (value: boolean) => void;
  removing: Removing | null;
  onDeleted: (path: string) => void;
  uploadInput: RefObject<HTMLInputElement | null>;
  uploadDir: RefObject<UploadDestination | null>;
  setClashes: State<Clashes | null>;
  clashes: Clashes | null;
  onOverwritten: (paths: string[]) => void;
  uploadProgress: UploadProgress | null;
  setUploadProgress: State<UploadProgress | null>;
};

export function useFileOperations({ attempt, generation, target, clip, api, base, forgetListings, onMoved, setClip, reload, menu, dirFor, setMenu, onOpenFile, root, goTo, setEditing, setOpError, refresh, setRemoving, editing, showHidden, toggleHidden, removing, onDeleted, uploadInput, uploadDir, setClashes, clashes, onOverwritten, uploadProgress, setUploadProgress }: FileOperationsOptions) {
  // After the session's environment changed, a response (or the rest of a loop) belongs to the old tree: no side effects.
  const fresh = () => { const serial = generation.current; return () => serial === generation.current; };
  const paste = (dir: string) => attempt(async () => {
    if (!clip) return;
    const live = fresh();
    const { mode, entry, target: owner } = clip;
    if (isDir(entry) && within(dir, entry.path)) throw new Error("不能移动到自身或其子目录。");
    if (mode === "cut") {
      const to = joinPath(dir, entry.name);
      if (to !== entry.path) {
        await api.post(`${base}/rename`, { target: owner, path: entry.path, newPath: to });
        if (!live()) return;
        forgetListings(entry.path);
        onMoved(entry.path, to);
      }
      setClip(null);
      reload(parentOf(entry.path), dir);
    } else {
      await api.post(`${base}/copy`, { target: owner, path: entry.path, toDir: dir });
      if (live()) reload(dir);
    }
  });

  const actOnEntry = (id: FileActionId, entry: DirEntry) => {
    if (id === "open") onOpenFile(entry);
    else if (id === "rename") setEditing({ kind: "rename", entry, target });
    else if (id === "duplicate") void attempt(async () => { const live = fresh(); await api.post(`${base}/copy`, { target, path: entry.path, toDir: parentOf(entry.path) }); if (live()) reload(parentOf(entry.path)); });
    else if (id === "copy" || id === "cut") setClip({ mode: id, entry, target });
    else if (id === "copyPath") void copyText(entry.path).then((ok) => { if (!ok) setOpError("写入剪贴板失败。"); });
    else if (id === "download") downloadFile(`${api.root}${base}/download`, target, entry.path);
    else if (id === "delete") setRemoving({ ...entry, target });
  };

  const act = (id: FileActionId) => {
    const entry = menu?.entry ?? null;
    const dir = dirFor(entry);
    setMenu(null);
    if (entry) actOnEntry(id, entry);
    if (id === "newFile" || id === "newFolder") { if (dir !== root) goTo(dir); setEditing({ kind: id === "newFile" ? "file" : "directory", dir, target }); }
    else if (id === "upload" && uploadProgress === null) { uploadDir.current = { dir, target }; uploadInput.current?.click(); }
    else if (id === "paste") void paste(dir);
    else if (id === "toggleHidden") toggleHidden(!showHidden);
    else if (id === "refresh") refresh();
  };

  const commitName = (name: string) => {
    const edit = editing;
    setEditing(null);
    if (!edit) return;
    // A new or renamed dotfile would vanish from the list right away; show hidden files instead.
    if (name.startsWith(".")) toggleHidden(true);
    if (/[\\/]/.test(name) || name === "." || name === "..") { setOpError("名称不能包含 / 或 \\。"); return; }
    void attempt(async () => {
      const live = fresh();
      if (edit.kind === "rename") {
        const from = edit.entry.path;
        const to = joinPath(parentOf(from), name);
        await api.post(`${base}/rename`, { target: edit.target, path: from, newPath: to });
        if (!live()) return;
        forgetListings(from);
        onMoved(from, to);
        if (clip && within(clip.entry.path, from)) setClip(null);
        reload(parentOf(from));
      } else {
        const path = joinPath(edit.dir, name);
        await api.post(`${base}/create`, { target: edit.target, path, type: edit.kind });
        if (!live()) return;
        reload(edit.dir);
        if (edit.kind === "file") onOpenFile({ path, name, type: "file" });
      }
    });
  };

  const confirmRemove = () => {
    const entry = removing;
    setRemoving(null);
    if (!entry) return;
    void attempt(async () => {
      const live = fresh();
      await api.post(`${base}/delete`, { target: entry.target, path: entry.path });
      if (!live()) return;
      forgetListings(entry.path);
      onDeleted(entry.path);
      if (clip && within(clip.entry.path, entry.path)) setClip(null);
      reload(parentOf(entry.path));
    });
  };

  const transfer = async (file: File, path: string, owner: string, live: () => boolean, overwrite = false) => {
    const url = `${api.root}${base}/upload?${new URLSearchParams({ target: owner, path, ...(overwrite ? { overwrite: "true" } : {}) })}`;
    const progress = (bytes: number) => { if (live()) setUploadProgress({ name: file.name, bytes, size: file.size }); };
    progress(0);
    try { await uploadFile(url, file, progress); }
    finally { if (live()) setUploadProgress(null); }
  };

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!uploadDir.current) return;
    const { dir, target: owner } = uploadDir.current;
    const live = fresh();
    const clash: { file: File; path: string }[] = [];
    setOpError("");
    for (const file of files) {
      const path = joinPath(dir, file.name);
      try {
        if (!live()) return;
        await transfer(file, path, owner, live);
      } catch (cause) {
        const error = toFailure(cause);
        if (!live()) return;
        if (error.code === "CONFLICT") clash.push({ file, path });
        else if (isTargetMismatch(error)) { setOpError(failure(error)); break; }
        else setOpError(`${file.name}：${failure(error)}`);
      }
    }
    if (!live()) return;
    reload(dir);
    if (clash.length) setClashes({ dir, items: clash, target: owner });
  };
  const overwrite = () => {
    if (!clashes) return;
    const { dir, items, target: owner } = clashes;
    setClashes(null);
    void attempt(async () => {
      const live = fresh();
      for (const { file, path } of items) {
        if (!live()) return;
        await transfer(file, path, owner, live, true);
      }
      if (!live()) return;
      onOverwritten(items.map((item) => item.path));
      reload(dir);
    });
  };
  return { act, commitName, confirmRemove, onUpload, overwrite };
}
