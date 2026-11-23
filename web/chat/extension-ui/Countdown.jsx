import { useRef } from "react";
import { useEffect } from "react";
import { useState } from "react";
import { Text } from "@mantine/core";
import { safeText } from "../../workbench/payloads/safe-text.js";
/** Seconds left until `expiresAt` (the Gateway's deadline), ticking; `onExpire` fires once when it passes. */
export function Countdown({ expiresAt, onExpire, label = (seconds) => `将在 ${seconds} 秒后关闭` }) {
  const rawDeadline = Number(expiresAt);
  const deadline = Number.isFinite(rawDeadline) ? rawDeadline : Date.parse(safeText(expiresAt));
  const active = Number.isFinite(deadline) && deadline > 0;
  const expiredRef = useRef(false);
  useEffect(() => { expiredRef.current = false; }, [deadline]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [active]);
  const remaining = active ? Math.max(0, deadline - now) : 0;
  useEffect(() => {
    if (active && remaining === 0 && !expiredRef.current) { expiredRef.current = true; onExpire?.(); }
  }, [active, remaining, onExpire]);
  return active ? <Text size="xs" c={remaining < 5000 ? "red" : "dimmed"} data-expires-at={deadline}>{label(Math.ceil(remaining / 1000))}</Text> : null;
}
