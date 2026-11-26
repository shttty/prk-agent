import { useRef } from "react";
import { useEditorContext } from "./use-editor-context.ts";
import { useFile } from "./use-file.ts";
import { isDirty } from "./is-dirty.ts";
import { baseName } from "../file-paths/base-name.ts";
import { CloseButton } from "@mantine/core";
import "./file-editor.css";
export function FileTab({ id, path }: { id: string; path: string }) {
  const { requestClose } = useEditorContext();
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
