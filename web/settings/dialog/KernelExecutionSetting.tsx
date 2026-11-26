import type { PageApi } from "../../shell/page/page-types.ts";
import { useEffect, useState } from "react";
import { IconBrandPython } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";

const path = "/settings/kernel-execution";
const label = "kernel 异步执行";

export function KernelExecutionSetting({ api }: { api: PageApi }) {
  const [value, setValue] = useState<boolean | null>(null);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let current = true;
    api.get<{ asyncExecution: boolean }>(path).then(({ asyncExecution }) => {
      if (!current) return;
      setValue(asyncExecution);
      setStatus("ready");
    }).catch(() => { if (current) setStatus("failed"); });
    return () => { current = false; };
  }, [api]);

  const save = async (enabled: boolean) => {
    setValue(enabled);
    setStatus("saving");
    try {
      const { asyncExecution } = await api.post<{ asyncExecution: boolean }>(path, { asyncExecution: enabled });
      setValue(asyncExecution);
      setStatus("ready");
    } catch {
      setValue(value);
      setStatus("failed");
    }
  };

  return <section className="settings-section" data-section="kernel-execution">
    <h3 className="pi-settings-heading">Kernel</h3>
    <div className="pi-settings-group"><div className="pi-settings-row is-static">
      <span className="pi-settings-icon" aria-hidden="true"><IconBrandPython size={16} stroke={1.7} /></span>
      <span className="pi-settings-title">{label}</span>
      <PrkSwitch id="setting-kernel-async-execution" aria-label={label} checked={value === true} data-status={status}
        disabled={value === null || status === "saving"} onChange={(event) => void save(event.currentTarget.checked)} />
    </div></div>
    {status === "failed" ? <InlineAlert role="alert" size="xs">{value === null ? "读取执行设置失败。" : "保存执行设置失败。"}</InlineAlert> : null}
  </section>;
}
