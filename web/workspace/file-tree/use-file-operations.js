import { isDir } from "../file-paths/is-dir.js";
import { within } from "../file-paths/within.js";
import { joinPath } from "../file-paths/join-path.js";
import { parentOf } from "../file-paths/parent-of.js";
import { copyText } from "../file-actions/copy-text.js";
import { downloadFile } from "../file-actions/download-file.js";
import { uploadFile } from "../file-actions/upload-file.js";
import { failure } from "./failure.js";
import { isTargetMismatch } from "../file-store/target-mismatch.js";
// Every request names the target its intent belongs to (`target`): the menu click, the clipboard, the name input, the delete
// prompt and the upload's clash list each remember it, so nothing is re-targeted after a transfer or a confirmation.
export function useFileOperations({ attempt, generation, target, clip, api, base, forgetListings, onMoved, setClip, reload, menu, dirFor, setMenu, onOpenFile, root, goTo, setEditing, setOpError, refresh, setRemoving, editing, showHidden, toggleHidden, removing, onDeleted, uploadInput, uploadDir, setClashes, clashes, onOverwritten, uploadProgress, setUploadProgress }) {
  // After the session's environment changed, a response (or the rest of a loop) belongs to the old tree: no side effects.
  const fresh = () => { const serial = generation.current; return () => serial === generation.current; };
  const paste = (dir) => attempt(async () => {
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

  const act = (id) => {
    const entry = menu?.entry ?? null;
    const dir = dirFor(entry);
    setMenu(null);
    if (id === "open") onOpenFile(entry);
    else if (id === "newFile" || id === "newFolder") { if (dir !== root) goTo(dir); setEditing({ kind: id === "newFile" ? "file" : "directory", dir, target }); }
    else if (id === "upload" && uploadProgress === null) { uploadDir.current = { dir, target }; uploadInput.current?.click(); }
    else if (id === "paste") void paste(dir);
    else if (id === "rename") setEditing({ kind: "rename", entry, target });
    else if (id === "duplicate") void attempt(async () => { const live = fresh(); await api.post(`${base}/copy`, { target, path: entry.path, toDir: parentOf(entry.path) }); if (live()) reload(parentOf(entry.path)); });
    else if (id === "copy" || id === "cut") setClip({ mode: id, entry, target });
    else if (id === "copyPath") void copyText(entry.path).then((ok) => { if (!ok) setOpError("写入剪贴板失败。"); });
    else if (id === "download") downloadFile(`${api.root}${base}/download`, target, entry.path);
    else if (id === "toggleHidden") toggleHidden(!showHidden);
    else if (id === "refresh") refresh();
    else if (id === "delete") setRemoving({ ...entry, target });
  };

  const commitName = (name) => {
    const edit = editing;
    setEditing(null);
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

  const transfer = async (file, path, owner, live, overwrite = false) => {
    const url = `${api.root}${base}/upload?${new URLSearchParams({ target: owner, path, ...(overwrite ? { overwrite: "true" } : {}) })}`;
    const progress = (bytes) => { if (live()) setUploadProgress({ name: file.name, bytes, size: file.size }); };
    progress(0);
    try { await uploadFile(url, file, progress); }
    finally { if (live()) setUploadProgress(null); }
  };

  const onUpload = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    const { dir, target: owner } = uploadDir.current;
    const live = fresh();
    const clash = [];
    setOpError("");
    for (const file of files) {
      const path = joinPath(dir, file.name);
      try {
        if (!live()) return;
        await transfer(file, path, owner, live);
      } catch (error) {
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
