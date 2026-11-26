import { CloseButton } from "@mantine/core";
import { useEffect } from "react";
import { useEditorContext } from "../file-editor/use-editor-context.ts";
import { useDebugModePreference } from "../debug-tools/use-debug-mode-preference.ts";
import "../file-editor/file-editor.css";

export function PromptTab({ id }: { id: string }) {
  const { closeTab } = useEditorContext();
  const [debug] = useDebugModePreference();
  // A tab restored from the saved layout outlives the switch: with debug mode off it closes itself.
  useEffect(() => { if (!debug) closeTab(id); }, [debug, closeTab, id]);
  return <div className="pi-tab" data-kind="prompt" title="提示词" onPointerUp={(event) => { if (event.button === 1) closeTab(id); }}>
    <span className="pi-tab-name">提示词</span>
    <CloseButton size="xs" className="pi-tab-close" data-action="close-tab" aria-label="关闭提示词" onPointerDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); closeTab(id); }} />
  </div>;
}
