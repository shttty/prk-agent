import { useState } from "react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
type FoldMoreProps = {
  lines?: number; bytes?: number; totalLines?: number; rest?: unknown; onExpand?: (value?: unknown) => void;
  action?: string; imageIndex?: number; label?: string;
};

/** A local remainder or an on-demand loader; failed loads keep the preview and can be retried. */
export function FoldMore({ lines, bytes, totalLines, rest, onExpand, action = "expand-lines", imageIndex, label }: FoldMoreProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const size = bytes === undefined ? "" : bytes < 1024 ? `${bytes} B`
    : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  const expand = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try { const value = typeof rest === "function" ? await rest() : rest; onExpand?.(value); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "工具内容加载失败。"); }
    finally { setLoading(false); }
  };
  return <>
    <button type="button" className="pi-fold-more" data-action={action} data-image-index={imageIndex} data-hidden-lines={lines} data-total-bytes={bytes} data-status={loading ? "loading" : error ? "error" : "ready"} disabled={loading} onClick={() => void expand()}>
      {loading ? "正在加载…" : label ?? (bytes !== undefined ? `展开全文 · ${totalLines} 行 · ${size}` : `展开剩余 ${lines} 行`)}
    </button>
    {error ? <InlineAlert data-kind="tool-content-error" m="xs">{error}</InlineAlert> : null}
  </>;
}
