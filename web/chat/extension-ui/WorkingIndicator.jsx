import { useState } from "react";
import { useEffect } from "react";
import { AnsiText } from "../ansi/AnsiText.jsx";
import StatusDot from "../../design-system/status-dot/StatusDot.jsx";
export function WorkingIndicator({ indicator }) {
  const frames = Array.isArray(indicator?.frames) ? indicator.frames : [];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (!frames.length) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % frames.length), Math.max(1, Number(indicator?.intervalMs) || 80));
    return () => window.clearInterval(timer);
  }, [frames.length, indicator?.intervalMs]);
  return frames.length ? <span aria-hidden="true"><AnsiText text={frames[index % frames.length]} /></span> : Array.isArray(indicator?.frames) ? null : <StatusDot tone="run" size={7} />;
}
