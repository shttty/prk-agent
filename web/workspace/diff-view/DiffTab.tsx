import { useEditorContext } from "../file-editor/use-editor-context.ts";
import { baseName } from "../file-paths/base-name.ts";
import { CloseButton } from "@mantine/core";
import "./diff-view.css";
import "../file-editor/file-editor.css";
export function DiffTab({ id, path }: { id: string; path: string }) {
  const { closeTab } = useEditorContext();
  const name = baseName(path);
  return <div className="pi-tab" data-path={path} data-kind="diff" title={`${path}（变更）`}
    onPointerUp={(event) => { if (event.button === 1) closeTab(id); }}>
    <span className="pi-tab-name">{name}</span>
    <span className="pi-tab-kind" aria-hidden="true">±</span>
    <CloseButton size="xs" className="pi-tab-close" data-action="close-tab" aria-label={`关闭 ${name} 的变更`} onPointerDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); closeTab(id); }} />
  </div>;
}
