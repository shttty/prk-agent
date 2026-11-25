import { useState } from "react";
import { notificationsAvailable } from "../../chat/ask-alert/notifications-available.js";
import { askNotifyEnabled } from "../../chat/ask-alert/ask-notify-enabled.js";
import { encodeLayoutCode } from "../../shell/layout/encode-layout-code.js";
import { disableAskNotify } from "../../chat/ask-alert/disable-ask-notify.js";
import { enableAskNotify } from "../../chat/ask-alert/enable-ask-notify.js";
import ThemeSettings from "../theme-library/ThemeSettings.jsx";
import { Row } from "./SettingsRow.jsx";
import { IconLayoutBoardSplit } from "@tabler/icons-react";
import { IconClipboardCopy } from "@tabler/icons-react";
import { Textarea } from "@mantine/core";
import { IconBell } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";
import { Text } from "@mantine/core";
import GatewayRestartSettings from "../gateway-restart/GatewayRestartSettings.jsx";
import { KernelExecutionSetting } from "./KernelExecutionSetting.jsx";
import { ToolTitleSetting } from "./ToolTitleSetting.jsx";
import { TurnFoldSetting } from "./TurnFoldSetting.jsx";
import { NoAnimationSetting } from "./NoAnimationSetting.jsx";
import { TerminalDisplaySettings } from "./TerminalDisplaySettings.jsx";
export function GeneralSettings({ onReset, layoutContext, gatewayRestartUnit, api }) {
  const [status, setStatus] = useState(null);
  const available = notificationsAvailable();
  const [notify, setNotify] = useState(askNotifyEnabled);
  const [refused, setRefused] = useState(false);
  const copy = async () => {
    const code = await encodeLayoutCode(layoutContext());
    try { await navigator.clipboard.writeText(code); setStatus({ kind: "copied" }); }
    catch { setStatus({ kind: "manual", code }); }
  };
  const toggleNotify = async (on) => {
    if (!on) { disableAskNotify(); setNotify(false); setRefused(false); return; }
    const granted = await enableAskNotify();
    setNotify(granted); setRefused(!granted);
  };
  return <div className="pi-settings-body">
    <ThemeSettings />
    <section className="settings-section" data-section="appearance">
      <h3 className="pi-settings-heading">显示</h3>
      <div className="pi-settings-group"><NoAnimationSetting /><TurnFoldSetting /></div>
    </section>
    <TerminalDisplaySettings />
    <section className="settings-section" data-section="layout">
      <h3 className="pi-settings-heading">布局</h3>
      <div className="pi-settings-group">
        <Row id="reset-layout" icon={IconLayoutBoardSplit} title="重置布局" fact={status?.kind === "reset" ? "已重置" : null} factProps={{ id: "settings-status", "data-status": "reset", role: "status" }} onClick={() => { onReset(); setStatus({ kind: "reset" }); }} />
        <Row id="copy-layout-code" icon={IconClipboardCopy} title="复制布局码" fact={status?.kind === "copied" ? "已复制" : null} factProps={{ id: "settings-status", "data-status": "copied", role: "status" }} onClick={() => void copy()} />
      </div>
      {status?.kind === "manual" ? <Textarea id="layout-code" label="布局码" readOnly autosize maxRows={6} value={status.code} onFocus={(event) => event.currentTarget.select()} /> : null}
    </section>
    <section className="settings-section" data-section="notify">
      <h3 className="pi-settings-heading">提醒</h3>
      <div className="pi-settings-group"><div className="pi-settings-row is-static">
        <span className="pi-settings-icon" aria-hidden="true"><IconBell size={16} stroke={1.7} /></span>
        <span className="pi-settings-title">提问等待时发系统通知</span>
        <PrkSwitch id="setting-ask-notify" checked={notify} disabled={!available} aria-label="提问等待时发系统通知" onChange={(event) => void toggleNotify(event.currentTarget.checked)} />
      </div></div>
      {!available ? <Text id="ask-notify-note" size="xs" c="dimmed">需要 HTTPS 或 localhost 访问。</Text> : refused ? <Text id="ask-notify-note" size="xs" c="dimmed">浏览器未允许通知。</Text> : null}
    </section>
    <KernelExecutionSetting api={api} />
    <ToolTitleSetting api={api} />
    <GatewayRestartSettings unit={gatewayRestartUnit} api={api} />
  </div>;
}
