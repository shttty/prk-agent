import "./turns.css";
import { useContext } from "react";
import { useState } from "react";
import { useEffectEvent } from "react";
import { useEffect } from "react";
import StatusDot from "../../../design-system/status-dot/StatusDot.jsx";
import { IconChevronRight } from "@tabler/icons-react";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { PresentationContext } from "../presentation-context.js";
import { presentationKey } from "../presentation/presentation-key.js";
import { isPresentationOpen } from "../presentation/is-presentation-open.js";
import { TurnContext } from "./turn-context.js";
import { formatWorkTime } from "./format-work-time.js";
export function TurnProcess({ indices, children }) {
  const message = useContext(TurnContext);
  const context = useContext(PresentationContext);
  const parts = Array.isArray(message?.content) ? message.content : [];
  const tools = indices.map((index) => parts[index]).filter((part) => part?.type === "tool-call");
  const running = message?.status?.type === "running";
  const interrupted = tools.some((part) => (part.result?.result || part.result)?.details?.interrupted === true);
  const hasAnswer = indices.length < parts.length;
  const failed = tools.some((part) => part.isError || part.metadata?.outcome === "unknown");
  const custom = message?.metadata?.custom || {};
  const workMs = Number(custom.answerAt) - Number(custom.turnStartedAt);
  const turnId = `turn:${safeText(message?.id)}`;
  const openedTools = context?.openedTools;
  const key = context ? presentationKey(context.sessionId, turnId) : turnId;
  const childOpen = tools.some((part) => isPresentationOpen(openedTools, context ? presentationKey(context.sessionId, part.toolCallId) : part.toolCallId, part.toolCallId));
  const [explicit, setExplicit] = useState(() => (isPresentationOpen(openedTools, key, turnId) ? true : null));
  const syncTurnOpen = useEffectEvent(() => {
    setExplicit(isPresentationOpen(context.openedTools, key, turnId) ? true : null);
  });
  useEffect(() => {
    if (context?.presentationRevision === undefined) return;
    syncTurnOpen();
  }, [context?.streamId, context?.presentationRevision, key, turnId]);
  const open = explicit ?? (context?.extensionUiRender?.toolsExpanded === true || running || !hasAnswer || childOpen);
  const setOpened = (next) => {
    if (next === open) return;
    setExplicit(next);
    if (!context?.actions?.savePresentation) return;
    const opened = new Set(openedTools);
    if (next) opened.add(key); else opened.delete(key);
    context.actions.savePresentation({ openedTools: [...opened].slice(-128) });
  };
  const count = tools.length ? `${tools.length} 次工具调用` : "";
  const verb = running ? "正在处理" : interrupted ? "已中断" : failed ? "已处理，有失败" : "已处理";
  const time = !running && Number.isFinite(workMs) && workMs > 0 ? ` ${formatWorkTime(workMs)}` : "";
  return (
    <details className="pi-turn-process" open={open} onToggle={(event) => { if (event.target === event.currentTarget) setOpened(event.currentTarget.open); }} data-state={running ? "running" : interrupted ? "interrupted" : failed ? "error" : "done"}>
      <summary className="pi-turn-summary" onClick={(event) => { event.preventDefault(); context?.preserveDisclosure?.(event.currentTarget); setOpened(!open); }}>
        {running ? <StatusDot tone="run" size={7} /> : <IconChevronRight className="pi-turn-caret" size={14} stroke={1.8} aria-hidden="true" />}
        <span className="pi-turn-label">{verb}{time}{count ? ` · ${count}` : ""}</span>
      </summary>
      <div className="pi-turn-steps">{children}</div>
    </details>
  );
}
