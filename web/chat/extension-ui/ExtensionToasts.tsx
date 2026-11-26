import LeaveList from "../../design-system/motion/LeaveList.tsx";
import { useChatState } from "../thread/use-chat-state.ts";
import { useState } from "react";
import { useEffectEvent } from "react";
import { useEffect } from "react";
import { Notification } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";
import { IconAlertCircle } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { AnsiText } from "../ansi/AnsiText.tsx";
type ToastType = "warning" | "error";
const isToastType = (type: string): type is ToastType => type in TOAST_MS;

// Plugin `notify` toasts only for warning/error (info stays as the anchored in-chat line); how long each stays up after it was raised (ms).
export const TOAST_MS: Record<ToastType, number> = { warning: 12000, error: 12000 };

export const TOAST_ICONS: Record<ToastType, Icon> = { warning: IconAlertTriangle, error: IconAlertCircle };

export const TOAST_COLORS: Record<ToastType, string> = { warning: "yellow", error: "red" };

const findToast = (id: string) => document.querySelector<HTMLElement>(`[data-toast-id="${CSS.escape(id)}"]`);

const findThread = () => document.querySelector<HTMLElement>(".pi-thread");

/** Plugin `notify` warning/error as toasts over the top of the transcript: notices of this session raised within TOAST_MS. */
export function ExtensionToasts() {
  const sessionId = useChatState((state) => state.session.snapshot?.sessionId);
  const notifications = useChatState((state) => state.session.extensionUi?.notifications);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(() => new Set());
  const toasts = (notifications || []).filter((notice): notice is typeof notice & { type: ToastType } => isToastType(notice.type) && notice.sessionId === sessionId && !dismissed.has(notice.id) && now - new Date(notice.createdAt).getTime() < TOAST_MS[notice.type]);
  const active = toasts.length > 0;
  const tick = useEffectEvent(() => setNow(Date.now()));
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  // The leave list stays mounted when the last toast goes, so that one slides off too.
  const leave = <LeaveList keys={toasts.map((notice) => notice.id)} find={findToast} host={findThread} edge="up" />;
  if (!active) return <>{leave}{null}</>;
  return <>{leave}<div className="pi-toasts" aria-live="polite">
    {toasts.map((notice) => {
      const Icon = TOAST_ICONS[notice.type];
      return <Notification key={notice.id} data-type={notice.type} data-toast-id={notice.id} role={notice.type === "error" ? "alert" : "status"} color={TOAST_COLORS[notice.type]} icon={<Icon size={16} aria-hidden="true" />} onClose={() => setDismissed((current) => new Set(current).add(notice.id))} closeButtonProps={{ "aria-label": "关闭提示" }}>
        <AnsiText text={notice.message} />
      </Notification>;
    })}
  </div></>;
}
