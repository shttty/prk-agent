import type { PageApi } from "../../shell/page/page-types.ts";
import { useEffect, useState } from "react";
import { IconMessageCode } from "@tabler/icons-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";

const path = "/settings/tool-title";
const label = "工具调用标题";

export function ToolTitleSetting({ api }: { api: PageApi }) {
  const [value, setValue] = useState<boolean | null>(null);
  const [status, setStatus] = useState("loading");
  useEffect(() => {
    let current = true;
    api.get(path).then(({ enabled }) => {
      if (!current) return;
      setValue(enabled);
      setStatus("ready");
    }).catch(() => { if (current) setStatus("failed"); });
    return () => { current = false; };
  }, [api]);

  const save = async (enabled: boolean) => {
    setValue(enabled);
    setStatus("saving");
    try {
      const saved = await api.post(path, { enabled });
      setValue(saved.enabled);
      setStatus("ready");
    } catch {
      setValue(value);
      setStatus("failed");
    }
  };

  return <section className="settings-section" data-section="tool-title">
    <h3 className="pi-settings-heading">工具</h3>
    <div className="pi-settings-group"><div className="pi-settings-row is-static">
      <span className="pi-settings-icon" aria-hidden="true"><IconMessageCode size={16} stroke={1.7} /></span>
      <span className="pi-settings-title">{label}</span>
      <PrkSwitch id="setting-tool-title" aria-label={label} checked={value === true} data-status={status}
        disabled={value === null || status === "saving"} onChange={(event) => void save(event.currentTarget.checked)} />
    </div></div>
    {status === "failed" ? <InlineAlert role="alert" size="xs">{value === null ? "读取设置失败。" : "保存设置失败。"}</InlineAlert> : null}
  </section>;
}
