import { useEffect, useState } from "react";
import type { PromptReport } from "../../../src/gateway/wire/web-types.ts";
import { useEditorContext } from "../file-editor/use-editor-context.ts";

type PromptState = { status: "loading" } | { status: "ok"; report: PromptReport } | { status: "error"; message: string };

/** The session's last captured provider request, read when the panel is first on screen and again on `reload`; a reload keeps the old report until the new one arrives. */
export function usePromptReport(visible: boolean) {
  const { loadPrompt } = useEditorContext();
  const [state, setState] = useState<PromptState>({ status: "loading" });
  const [serial, setSerial] = useState(0);
  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    loadPrompt().then((report) => { if (live) setState({ status: "ok", report }); }).catch((error: unknown) => { if (live) setState({ status: "error", message: error instanceof Error ? error.message : "无法读取提示词。" }); });
    return () => { live = false; };
  }, [loadPrompt, visible, serial]);
  return { state, reload: () => setSerial((value) => value + 1) };
}
