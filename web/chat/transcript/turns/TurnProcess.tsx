import "./turns.css";
import { useContext } from "react";
import type { ReactNode } from "react";
import { isPayload } from "../../payload/is-payload.ts";
import StatusDot from "../../../design-system/status-dot/StatusDot.tsx";
import { IconChevronRight } from "@tabler/icons-react";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { hasRunningTool } from "../../conversation/tools/has-running-tool.ts";
import { PresentationContext } from "../presentation-context.ts";
import { presentationKey } from "../presentation/presentation-key.ts";
import { readDisclosure } from "../presentation/read-disclosure.ts";
import { saveDisclosure } from "../presentation/save-disclosure.ts";
import { hasText } from "./has-text.ts";
import { TurnContext } from "./turn-context.ts";
import { formatWorkTime } from "./format-work-time.ts";
export function TurnProcess({ groupKey, indices, children }: { groupKey: string; indices: number[]; children?: ReactNode }) {
  const message = useContext(TurnContext);
  const context = useContext(PresentationContext);
  const parts = message?.content ?? [];
  const tools = indices.map((index) => parts[index]).filter((part) => part?.type === "tool-call");
  const whole = groupKey === "process";
  const running = message?.status?.type === "running" && (whole || hasRunningTool(tools) ||
    !parts.slice((indices.at(-1) ?? -1) + 1).some((part) => part.type !== "text" || hasText(part)));
  const interrupted = tools.some((part) => { const result = isPayload(part.result?.result) ? part.result.result : part.result; return isPayload(result?.details) && result.details.interrupted === true; });
  const hasAnswer = indices.length < parts.length;
  const failed = tools.some((part) => part.isError || part.metadata?.outcome === "unknown");
  const custom = message?.metadata.custom ?? {};
  const workMs = Number(custom.answerAt) - Number(custom.turnStartedAt);
  const turnId = `turn:${safeText(message?.id)}`;
  const key = presentationKey(context?.sessionId, whole ? turnId : `${turnId}:segment:${encodeURIComponent(groupKey)}`);
  const openedTools = context?.openedTools;
  const childOpen = tools.some(({ toolCallId }) => readDisclosure(openedTools, presentationKey(context?.sessionId, toolCallId), { fallbackId: toolCallId }));
  const open = readDisclosure(openedTools, key, {
    fallbackId: whole ? turnId : undefined, defaultOpen: Boolean(context?.expandTools || running || (whole && !hasAnswer) || childOpen),
  });
  const setOpened = (next: boolean) => { if (next !== open) saveDisclosure(context?.actions, key, next); };
  const count = tools.length ? `${tools.length} 次工具调用` : "";
  const verb = running ? "正在处理" : interrupted ? "已中断" : failed ? "已处理，有失败" : "已处理";
  const time = whole && !running && Number.isFinite(workMs) && workMs > 0 ? ` ${formatWorkTime(workMs)}` : "";
  const label = !whole && running ? verb
    : !whole && !interrupted && !failed ? count || "思考"
    : `${verb}${time}${count ? ` · ${count}` : ""}`;
  return (
    <details className="pi-turn-process" open={open} onToggle={(event) => { if (event.target === event.currentTarget) setOpened(event.currentTarget.open); }} data-turn-fold={whole ? "whole" : "segmented"} data-state={running ? "running" : interrupted ? "interrupted" : failed ? "error" : "done"}>
      <summary className="pi-turn-summary" onClick={(event) => { event.preventDefault(); context?.preserveDisclosure?.(event.currentTarget); setOpened(!open); }}>
        {running ? <StatusDot tone="run" size={7} /> : <IconChevronRight className="pi-turn-caret" size={14} stroke={1.8} aria-hidden="true" />}
        <span className="pi-turn-label">{label}</span>
      </summary>
      <div className="pi-turn-steps">{children}</div>
    </details>
  );
}
