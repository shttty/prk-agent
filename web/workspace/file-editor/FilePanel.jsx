import { useComputedColorScheme } from "@mantine/core";
import { Loader } from "@mantine/core";
import { Badge } from "@mantine/core";
import { Button } from "@mantine/core";
import { useFile } from "./use-file.js";
import { useEffect } from "react";
import { baseName } from "../file-paths/base-name.js";
import { FileBody } from "./FileBody.jsx";
import { isDirty } from "./is-dirty.js";
import { formatBytes } from "./format-bytes.js";
import "./file-editor.css";
export function FilePanel({ path, visible }) {
  const scheme = useComputedColorScheme("light");
  const [store, file] = useFile(path);
  // The file is read when its tab is first on screen; a tab restored behind another one waits until it is shown.
  useEffect(() => { if (visible) store.ensure(path); }, [store, path, visible]);
  const text = file && !file.loading && (!file.error || file.retargeted) && file.kind !== "image" && file.kind !== "binary";
  return <section className="pi-file" data-path={path} aria-label={baseName(path)}>
    {file ? <FileBody store={store} file={file} scheme={scheme} /> : <div className="pi-file-empty"><Loader size="sm" /></div>}
    <div className="pi-file-status">
      <span className="pi-file-status-path">{path}</span>
      {file?.saveError ? <Badge component="span" variant="light" color="red" size="sm" tt="none">{file.saveError}</Badge> : null}
      {text && (file.kind === "text" || file.view === "source") ? <Button data-action="save-file" size="compact-xs" variant="subtle" loading={file.saving} disabled={!isDirty(file) || file.writable === false || file.retargeted === true} onClick={() => void store.save(path)}>保存</Button> : null}
      {text && file.content ? <span>{formatBytes(new Blob([file.content]).size)}</span> : null}
    </div>
  </section>;
}
