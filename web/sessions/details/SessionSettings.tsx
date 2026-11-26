import { useState } from "react";
import { useEffect } from "react";
import { Text } from "@mantine/core";
import { Stack } from "@mantine/core";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { DelegationSetting } from "./DelegationSetting.tsx";
import { QueueSetting } from "./QueueSetting.tsx";
import { LocalToolsSetting } from "./LocalToolsSetting.tsx";
import { KernelLanguageSetting } from "./KernelLanguageSetting.tsx";
import { delegationLevel } from "./delegation-level.ts";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { resolveSessionSettingsFlags } from "./resolve-session-settings-flags.ts";
import { resolveSettingValues, type LoadedSettings, type SettingValues } from "./resolve-setting-values.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";
const SETTING_ROWS: [keyof SettingValues, string, string][] = [
  ["autoCompaction", "自动压缩", "快满时把早先的对话压成摘要。"],
  ["autoRetry", "自动重试", "过载、限流等临时错误自动重试。"],
];

type SessionSettingsProps = { actions: WorkbenchActions; opened: boolean };

export function SessionSettings({ actions, opened }: SessionSettingsProps) {
  const [loaded, setLoaded] = useState<LoadedSettings | null>(null);
  const [saving, setSaving] = useState("");
  const hostState = useWorkbench((state: WorkbenchState) => state.session.snapshot?.state);
  const connection = useWorkbench((state: WorkbenchState) => state.session.connection);
  const nativePending = useWorkbench((state: WorkbenchState) => state.session.pending.has("nativeActionPending"));
  const { live, idle } = resolveSessionSettingsFlags({ connection, hostState, nativePending });
  const delegation = useWorkbench((state: WorkbenchState) => delegationLevel(state.session.snapshot));
  const catalogCurrent = useWorkbench((state: WorkbenchState) => state.session.nativeCatalog?.value?.target?.current);
  const streamId = useWorkbench((state: WorkbenchState) => state.session.streamId);
  const snapshotSessionId = useWorkbench((state: WorkbenchState) => state.session.snapshot?.sessionId);
  const sessionKey = `${streamId || ""}:${snapshotSessionId || ""}`;
  const queue = useWorkbench((state: WorkbenchState) => state.queue);
  const selectedSessionId = useWorkbench((state: WorkbenchState) => state.selectedSessionId);
  useEffect(() => {
    if (!opened || !idle) return undefined;
    let active = true;
    void actions.nativeData("settings").then((data: SettingValues | null) => { if (active && data) setLoaded({ key: sessionKey, data }); });
    return () => { active = false; };
  }, [opened, idle, actions, sessionKey]);
  const values = resolveSettingValues(loaded, sessionKey, catalogCurrent);
  const change = async (key: keyof SettingValues, checked: boolean) => {
    setSaving(key);
    try {
      const ok = await actions.executeNativeAction("settings", { [key]: checked ? "on" : "off" }, { transcript: false });
      if (ok) setLoaded((prev) => ({ key: sessionKey, data: { ...((prev?.key === sessionKey ? prev.data : values) || {}), [key]: checked } }));
    } finally { setSaving(""); }
  };
  return <section className="session-section" aria-label="会话设置">
    <Text className="session-section-title">会话设置</Text>
    <Stack gap="sm">
      <QueueSetting queue={queue} disabled={!selectedSessionId} actions={actions} />
      {delegation ? <DelegationSetting level={delegation} disabled={!live} actions={actions} /> : null}
      <LocalToolsSetting actions={actions} blocked={!live} />
      <KernelLanguageSetting actions={actions} blocked={!idle} />
      {SETTING_ROWS.map(([key, title, description]) => <PrkSwitch key={key} id={`setting-${key}`} label={title} description={description} checked={values?.[key] === true} disabled={!idle || !values || Boolean(saving)} onChange={(event) => void change(key, event.currentTarget.checked)} />)}
      <Text size="xs" c="dimmed">{idle ? "只影响这个会话。" : "会话空闲时可以修改。"}</Text>
    </Stack>
  </section>;
}

