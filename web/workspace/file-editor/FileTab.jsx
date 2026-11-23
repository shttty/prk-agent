import { useContext } from "react";
import { useRef } from "react";
import { EditorContext } from "./editor-context.js";
import { useFile } from "./use-file.js";
import { isDirty } from "./is-dirty.js";
import { baseName } from "../file-paths/base-name.js";
import { CloseButton } from "@mantine/core";
import "./file-editor.css";
export function FileTab({ id, path }) {
  const { requestClose } = useContext(EditorContext);
  const [, file] = useFile(path);
  const dirty = isDirty(file);
  const name = baseName(path);
  const middle = useRef(false);
  return <div className="pi-tab" data-path={path} data-dirty={dirty ? "true" : undefined} title={path}
    onPointerDown={(event) => { middle.current = event.button === 1; }}
    onPointerUp={(event) => { if (middle.current && event.button === 1) { middle.current = false; requestClose(id, path); } }}
    onPointerLeave={() => { middle.current = false; }}>
    <span className="pi-tab-name">{name}</span>
    {dirty ? <span className="pi-file-dirty" role="img" aria-label="未保存">●</span> : null}
    <CloseButton size="xs" className="pi-tab-close" data-action="close-tab" aria-label={`关闭 ${name}`} onPointerDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); requestClose(id, path); }} />
  </div>;
}
