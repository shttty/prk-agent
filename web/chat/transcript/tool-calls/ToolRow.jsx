import "./tool-calls.css";
import { useContext } from "react";
import { useMemo } from "react";
import { VisuallyHidden } from "@mantine/core";
import { Stack } from "@mantine/core";
import InlineAlert from "../../../design-system/inline-alert/InlineAlert.jsx";
import { IconChevronRight } from "@tabler/icons-react";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { printable } from "../../../workbench/payloads/printable.js";
import { ExtensionNode } from "../../extension-ui/ExtensionNode.jsx";
import { stripAnsi } from "../../ansi/strip-ansi.js";
import { ToolBody } from "./body/ToolBody.jsx";
import { CodeBlock } from "../../code/CodeBlock.jsx";
import { parseToolArgs } from "../../tool-text/parse-tool-args.js";
import { toolKind } from "../../tool-text/tool-kind.js";
import { parseDiff } from "../../tool-text/parse-diff.js";
import { toolHeadline } from "../../tool-text/tool-headline.js";
import { PresentationContext } from "../presentation-context.js";
import { FILE_TOOLS } from "../../tool-text/tool-text-constants.js";
import { presentationKey } from "../presentation/presentation-key.js";
import { readDisclosure } from "../presentation/read-disclosure.js";
import { saveDisclosure } from "../presentation/save-disclosure.js";
import { toolDurationMs } from "./tool-duration-ms.js";
import { toolDuration } from "./tool-duration.js";
import { formatElapsed } from "./format-elapsed.js";
import { useTicker } from "./use-ticker.js";
import { TOOL_STATE_ICONS } from "./tool-call-constants.js";
import { toolTitle } from "./tool-title.js";
import { peerSendSummary } from "./peer-send-summary.js";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.js";
import { KernelCellBody } from "./kernel-cell/KernelCellBody.jsx";
export function ToolRow({ toolCallId, toolName, title, argsText, result, artifact, isError, status, metadata, timing, kernelCell }) {
  const context = useContext(PresentationContext);
  const interrupted = kernelCell ? kernelCell.status === "aborted" : (result?.result || result)?.details?.interrupted === true;
  const key = context ? presentationKey(context.sessionId, toolCallId) : toolCallId;
  const deferred = Boolean((metadata?.inputPreview && !metadata.inputLoaded) || (metadata?.outputPreview && !metadata.outputLoaded));
  const loadContent = () => context.actions.loadToolContent(toolCallId, metadata);
  const open = readDisclosure(context?.openedTools, key, { fallbackId: toolCallId, defaultOpen: context?.expandTools });
  const partialOutput = safeText(artifact?.output);
  const output = result === undefined ? partialOutput : printable(result);
  const running = kernelCell ? kernelCell.status === "running" : artifact?.running === true || status?.type === "running";
  const unknown = kernelCell ? kernelCell.status === "unknown" : artifact?.unknown === true || metadata?.outcome === "unknown" || result?.details?.outcome === "unknown" || result?.outcome === "unknown";
  const failed = kernelCell ? kernelCell.status === "error" : isError;
  const toolReturned = result !== undefined || artifact?.running === false;
  const label = interrupted ? "已中断" : unknown ? "结果未知" : failed ? "失败" : running ? kernelCell?.stopping ? "停止中" : kernelCell && toolReturned ? "后台运行" : "运行中" : result === undefined && !kernelCell ? "等待结果" : "已完成";
  const toolState = interrupted ? "interrupted" : unknown ? "unknown" : failed ? "error" : running ? "running" : result === undefined && !kernelCell ? "pending" : "done";
  const StateIcon = TOOL_STATE_ICONS[toolState];
  const startedAt = Number(kernelCell?.startedAt ?? timing?.startedAt);
  const now = useTicker(running && Number.isFinite(startedAt));
  const durationMs = kernelCell ? kernelCell.elapsedMs : toolDurationMs(timing);
  const elapsedMs = kernelCell ? running ? Math.max(kernelCell.elapsedMs, now - startedAt) : kernelCell.elapsedMs : null;
  const code = safeText(argsText);
  const toolArgs = useMemo(() => parseToolArgs(code), [code]);
  const kind = metadata?.inputPreview && !metadata.inputLoaded ? "generic" : toolKind(toolName, toolArgs, code);
  // Built-in tools with a structured body ignore the host's renderer nodes: Pi's own renderers draw them as terminal text (ANSI, empty success results).
  const builtin = kind !== "generic";
  // Plugin renderings are keyed by the executing call's own id: the nested call's for a row reached through tool_call.
  const renderId = metadata?.renderId || toolCallId;
  const extensionTool = builtin || deferred ? undefined : context?.extensionUiRender?.tools?.[renderId];
  const rendererErrors = builtin ? undefined : context?.extensionUiRender?.toolErrors?.[renderId];
  const rendererError = [...new Set([rendererErrors?.call, rendererErrors?.result].filter((value) => typeof value === "string" && value))].map(stripAnsi).join(" · ");
  const resultBody = result?.result || result;
  const diff = kind === "edit" ? resultBody?.details?.diff : undefined;
  const parsedDiff = useMemo(() => (typeof diff === "string" ? parseDiff(diff) : null), [diff]);
  // Only session_send rows name a session; others do not subscribe to the session list.
  const sessions = useWorkbench((state) => (toolName === "session_send" ? state.sessions : null));
  // The call title heads the row; only a file path stays beside it, since the body does not repeat it.
  const summaryLine = title ? (FILE_TOOLS.has(kind) ? toolHeadline(kind, toolArgs, code) : "") : peerSendSummary(toolName, code, sessions) ?? toolHeadline(kind, toolArgs, code);
  // A default-shell plugin renderCall is the collapsed header (like Pi's own tool row) unless a call title heads the row; a renderer error falls back to name + args.
  const headerCall = !title && extensionTool?.shell === "default" && extensionTool.call && !rendererError ? extensionTool.call : null;
  // Only the first line fits the header; anything beyond it (or a non-text node) is shown in full at the top of the body.
  const callOverflows = headerCall && !(headerCall.kind === "text" && (headerCall.lines || []).filter((line) => stripAnsi(line).trim()).length <= 1);

  const setOpened = (next) => saveDisclosure(context?.actions, key, next);

  const outputText = output || (running ? "正在等待执行结果…" : unknown ? "执行结果未知，请检查当前状态。" : "（暂无输出）");
  if (extensionTool?.shell === "self") return <div data-tool-key={key} data-tool-name={toolName} data-via={metadata?.via} data-extension-shell="self" data-state={toolState}>
    {rendererError ? <InlineAlert data-extension-renderer-error={renderId}>{rendererError}</InlineAlert> : null}
    {extensionTool.call ? <ExtensionNode node={extensionTool.call} /> : <CodeBlock code={code || "（无输入）"} />}
    {extensionTool.result ? <ExtensionNode node={extensionTool.result} /> : <CodeBlock output code={outputText} />}
  </div>;

  return (
    <details
      className={`pi-tool tool-call${!interrupted && (unknown || failed) ? " is-error" : ""}${running ? " is-running" : ""}`}
      open={open}
      onToggle={(event) => { if (event.currentTarget.open !== open) setOpened(event.currentTarget.open); }}
      data-tool-key={key}
      data-tool-name={toolName}
      data-via={metadata?.via}
      data-extension-shell={extensionTool?.shell || undefined}
      data-state={toolState}
      data-content-state={deferred ? "preview" : metadata?.inputPreview || metadata?.outputPreview ? "loaded" : "inline"}
      {...(kernelCell ? { id: `kernel-cell-${kernelCell.cellId}`, "data-kind": "kernel-cell", "data-session-id": kernelCell.sessionId,
        "data-kernel-id": kernelCell.kernelId, "data-cell-id": kernelCell.cellId, "data-tool-call-id": kernelCell.toolCallId,
        "data-status": kernelCell.status, "data-tool-returned": String(toolReturned), "data-waiting-ask": String(kernelCell.waitingForAsk),
        "data-truncated": String(kernelCell.truncated), "data-elapsed-ms": elapsedMs, "data-checkpoint-step": kernelCell.checkpoint?.step,
        "data-delivery": kernelCell.delivery, "data-language": kernelCell.language, "data-mode": kernelCell.mode,
        "data-live-status": running ? kernelCell.stopping ? "stopping" : "running" : undefined } : {})}
    >
      <summary onClick={(event) => { event.preventDefault(); context?.preserveDisclosure?.(event.currentTarget); setOpened(!open); }}>
        <span className="pi-tool-state" aria-hidden="true"><StateIcon size={14} stroke={2} /></span>
        <span className="pi-tool-title">{headerCall
          ? <><VisuallyHidden className="tool-name">{toolTitle(toolName)}</VisuallyHidden><span className="pi-tool-call"><ExtensionNode node={headerCall} /></span></>
          : <><strong className="tool-name">{toolTitle(toolName)}</strong>{title ? <span className="pi-tool-call-title">{title}</span> : null}{summaryLine ? <code className="pi-tool-args">{summaryLine}</code> : null}{parsedDiff ? <span className="pi-tool-diffstat" data-add={parsedDiff.add} data-del={parsedDiff.del}>(<span className="is-add">+{parsedDiff.add}</span> <span className="is-del">-{parsedDiff.del}</span>)</span> : null}</>}</span>
        {metadata?.via ? <span className="pi-tool-via" data-via={metadata.via} title={`经 ${metadata.via} 调用`}>{metadata.via}</span> : null}
        {running && kernelCell?.mode ? <span className="pi-tool-via" data-kind="kernel-mode">{kernelCell.mode}</span> : null}
        {rendererError ? <InlineAlert py={2} data-extension-renderer-error={renderId}>{rendererError}</InlineAlert> : null}
        <span className="tool-status" data-state={toolState}>{label}</span>
        {running ? (Number.isFinite(startedAt) ? <span className="tool-elapsed" title="已运行时长">{formatElapsed(now - startedAt)}</span> : null)
          : <span className="tool-duration" data-duration-state={durationMs === null ? "unavailable" : "available"} {...(durationMs === null ? {} : { "data-duration-ms": String(durationMs) })}>{durationMs === null ? <VisuallyHidden>{toolDuration(null)}</VisuallyHidden> : toolDuration(durationMs)}</span>}
        <IconChevronRight className="pi-tool-caret" size={14} stroke={1.8} aria-hidden="true" />
      </summary>
      <Stack gap="xs" className="pi-tool-body">
        {kernelCell ? <KernelCellBody key={`${context?.streamId}:${kernelCell.kernelId}:${kernelCell.cellId}:${kernelCell.toolCallId}`} cell={{ ...kernelCell, elapsedMs }} code={code} active={open} inputDeferred={metadata?.inputLoaded ? undefined : metadata?.inputPreview} loadInput={loadContent} /> : <ToolBody
          kind={kind}
          args={toolArgs}
          code={code}
          output={output}
          outputText={outputText}
          result={resultBody}
          toolState={toolState}
          parsedDiff={parsedDiff}
          extensionTool={extensionTool}
          headerOnlyCall={Boolean(headerCall && !callOverflows)}
          active={open}
          contentMetadata={metadata}
          loadContent={loadContent}
        />}
      </Stack>
    </details>
  );
}
