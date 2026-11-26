import { useContext, useState } from "react";
import type { ToolContentPreview } from "../../../../../src/gateway/wire/web-types.ts";
import type { KernelCellView } from "./kernel-cell-presentation.ts";
import { isPayload } from "../../../payload/is-payload.ts";
import type { Payload } from "../../../payload/is-payload.ts";
import { PresentationContext } from "../../presentation-context.ts";
import { CodeBlock } from "../../../code/CodeBlock.tsx";
import { FoldMore } from "../../../code/FoldMore.tsx";
import { formatElapsed } from "../format-elapsed.ts";
import { contentText } from "../../../conversation/content-text.ts";
import { loadKernelResult } from "./load-kernel-result.ts";

type KernelCellBodyProps = { cell: KernelCellView; code: string; active: boolean; inputDeferred: ToolContentPreview | undefined; loadInput: () => Promise<unknown> };

export function KernelCellBody({ cell, code, active, inputDeferred, loadInput }: KernelCellBodyProps) {
  const context = useContext(PresentationContext);
  const [result, setResult] = useState<Payload | null>(null);
  const terminal = cell.status !== "running";
  const rawOutput = isPayload(result?.details) ? result.details.rawOutput : undefined;
  const output = result ? typeof rawOutput === "string" ? rawOutput : contentText(result.content) : cell.output;
  return <div className="pi-io" data-kind="kernel_code">
    <CodeBlock code={code} query={inputDeferred ? { name: "json" } : { name: cell.language === "bun" ? "typescript" : "python" }} mode="numbers" active={active} deferred={inputDeferred} loadContent={loadInput} />
    <div className="pi-io-rule" aria-hidden="true"><span>Output</span></div>
    <CodeBlock output code={output || (terminal ? "（暂无输出）" : "正在等待执行结果…")} active={active} />
    {terminal && !result && cell.delivery !== "unknown" ? <FoldMore action="load-kernel-result" label="展开最终结果" rest={() => context ? loadKernelResult(context.actions.api, cell) : Promise.reject(new Error("执行结果暂不可用。"))} onExpand={(value) => setResult(isPayload(value) ? value : null)} /> : null}
    <div className="pi-io-note" data-kind="kernel-elapsed" data-elapsed-ms={cell.elapsedMs}>已用 {formatElapsed(cell.elapsedMs)}</div>
    <div className="pi-io-note" data-kind="kernel-ask" data-waiting={String(cell.waitingForAsk)}>{cell.waitingForAsk ? "等待回答" : null}</div>
    {cell.language ? <div className="pi-io-note" data-kind="kernel-language" data-language={cell.language}>{[cell.language === "bun" ? "Bun" : "Python", cell.mode].filter(Boolean).join(" · ")}</div> : null}
    {cell.truncated ? <div className="pi-io-note" data-kind="kernel-truncation" data-truncated="true">输出已截断</div> : null}
    {cell.checkpoint ? <div className="pi-io-note" data-kind="kernel-checkpoint" data-step={cell.checkpoint.step}>运行提醒 {cell.checkpoint.step} · 已执行 {formatElapsed(cell.checkpoint.activeMs ?? 0)}</div> : null}
    {cell.reason ? <div className="pi-io-note" data-kind="kernel-reason">{cell.reason}</div> : null}
    {cell.notice && cell.delivery !== "delivered" ? <div className="pi-io-note" data-kind="kernel-notification" data-delivery={cell.delivery}>{cell.notice}</div> : null}
    {cell.imageCount ? <div className="pi-io-note" data-kind="kernel-images" data-count={cell.imageCount}>{cell.imageCount} 张图片</div> : null}
  </div>;
}
