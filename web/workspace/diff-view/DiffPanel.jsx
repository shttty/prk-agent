import { useContext } from "react";
import { useState } from "react";
import { useEffect } from "react";
import { useMemo } from "react";
import { EditorContext } from "../file-editor/editor-context.js";
import { rowsOf } from "./rows-of.js";
import { baseName } from "../file-paths/base-name.js";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import { Loader } from "@mantine/core";
import { Badge } from "@mantine/core";
import { Button } from "@mantine/core";
import { DiffBlock } from "../../chat/code/DiffBlock.jsx";
import { IconRefresh } from "@tabler/icons-react";
import "./diff-view.css";
import "../file-editor/file-editor.css";
export function DiffPanel({ path, visible }) {
  const { loadDiff } = useContext(EditorContext);
  const [result, setResult] = useState({ status: "idle" });
  const [serial, setSerial] = useState(0);
  // Read when first on screen (a tab restored behind another one waits) and again on request.
  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    setResult((current) => (current.status === "ok" ? current : { status: "loading" }));
    loadDiff(path).then((reply) => { if (live) setResult({ status: "ok", reply }); }).catch((error) => { if (live) setResult({ status: "error", message: error instanceof Error ? error.message : "无法读取变更。" }); });
    return () => { live = false; };
  }, [loadDiff, path, visible, serial]);
  const diff = useMemo(() => (result.status === "ok" ? rowsOf(result.reply) : null), [result]);
  return <section className="pi-file pi-diff" data-path={path} data-status={result.status} data-source={result.reply?.kind} aria-label={`${baseName(path)} 的变更`}>
    <div className="pi-diff-body">
      {result.status === "error" ? <div className="pi-file-empty"><InlineAlert>{result.message}</InlineAlert></div>
        : result.status !== "ok" ? <div className="pi-file-empty"><Loader size="sm" /></div>
        : diff ? <DiffBlock diff={diff} query={{ filename: path }} limit={Number.MAX_SAFE_INTEGER} />
        : <div className="pi-file-empty" data-empty="true">没有可显示的变更。</div>}
    </div>
    <div className="pi-file-status">
      <span className="pi-file-status-path">{path}</span>
      {result.reply?.truncated ? <Badge component="span" variant="light" color="yellow" size="sm" tt="none">已截断</Badge> : null}
      {diff ? <span className="pi-diff-counts"><span className={diff.add > 0 ? "is-add" : "is-zero"}>+{diff.add}</span> <span className={diff.del > 0 ? "is-del" : "is-zero"}>-{diff.del}</span></span> : null}
      <Button data-action="reload-diff" size="compact-xs" variant="subtle" leftSection={<IconRefresh size={12} />} loading={result.status === "loading"} onClick={() => setSerial((value) => value + 1)}>刷新</Button>
    </div>
  </section>;
}
