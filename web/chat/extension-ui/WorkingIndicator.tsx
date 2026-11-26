import { useState } from "react";
import { useEffect } from "react";
import { AnsiText } from "../ansi/AnsiText.tsx";
import StatusDot from "../../design-system/status-dot/StatusDot.tsx";
type WorkingIndicatorProps = { indicator?: { frames?: readonly string[]; intervalMs?: number } };

export function WorkingIndicator({ indicator }: WorkingIndicatorProps) {
  const frames = indicator?.frames ?? [];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (!frames.length) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % frames.length), Math.max(1, Number(indicator?.intervalMs) || 80));
    return () => window.clearInterval(timer);
  }, [frames.length, indicator?.intervalMs]);
  return frames.length ? <span aria-hidden="true"><AnsiText text={frames[index % frames.length]} /></span> : indicator?.frames ? null : <StatusDot tone="run" size={7} />;
}
