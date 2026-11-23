import { useState } from "react";
export const ERROR_TEXT = {
  NOT_CONFIGURED: "未配置 gateway.systemdUnit。",
  SYSTEMCTL_TIMEOUT: "systemctl 超时，重启结果未知。",
};

/** The one Gateway restart flow (`POST /api/gateway/restart`, run by the API process through systemd): confirm, then
 * idle → running → done | failed. Every restart entry (通用 settings, plugin notice) uses this; nothing reconnects here. */
export function useGatewayRestart(api) {
  const [confirming, setConfirming] = useState(false);
  const [phase, setPhase] = useState({ status: "idle" });
  const restart = async () => {
    setConfirming(false);
    setPhase({ status: "running" });
    try {
      await api.post("/gateway/restart", {});
      setPhase({ status: "done" });
    } catch (error) {
      setPhase({ status: "failed", message: ERROR_TEXT[error?.code] || error?.message || "重启失败。" });
    }
  };
  return { confirming, setConfirming, phase, restart };
}
