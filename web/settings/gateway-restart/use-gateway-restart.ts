import type { PageApi } from "../../shell/page/page-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { useState } from "react";

type RestartPhase = { status: "idle" | "running" | "done" } | { status: "failed"; message: string };
export const ERROR_TEXT: Record<string, string> = {
  NOT_CONFIGURED: "未配置 gateway.systemdUnit。",
  SYSTEMCTL_TIMEOUT: "systemctl 超时，重启结果未知。",
};

/** The one Gateway restart flow (`POST /api/gateway/restart`, run by the API process through systemd): confirm, then
 * idle → running → done | failed. Every restart entry (通用 settings, plugin notice) uses this; nothing reconnects here. */
export function useGatewayRestart(api: PageApi) {
  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState<RestartPhase>({ status: "idle" });
  const restart = async () => {
    setConfirming(false);
    setPhase({ status: "running" });
    try {
      await api.post("/gateway/restart", {});
      setPhase({ status: "done" });
    } catch (cause) {
      const error = toFailure(cause);
      setPhase({ status: "failed", message: ERROR_TEXT[error.code ?? ""] || error.message || "重启失败。" });
    }
  };
  return { confirming, setConfirming, phase, restart };
}
