import { useEffect, useState } from "react";
import { ActionIcon, Flex, Loader, Tabs, Text } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { labelForTarget } from "../../sessions/sidebar/labels/label-for-target.ts";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import CapabilitiesPanel from "../../settings/capabilities/CapabilitiesPanel.jsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { TargetEditor } from "../editor/TargetEditor.tsx";
import type { EditorConfig } from "../editor/editor-types.ts";
import "./instance-settings.css";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

type InstanceSettingsProps = { actions: WorkbenchActions; id: string; mobile: boolean; onClose: () => void; onBack?: () => void };

/** One instance's settings: its connection config (the same editor) and default tool/Skills switches. Opened from the
 * sidebar group menu (a dialog) and from the settings window's instance page (`onBack` set: embedded with a back button). */
export function InstanceSettings({ actions, id, mobile, onClose, onBack }: InstanceSettingsProps) {
  const target = useWorkbench((state: WorkbenchState) => state.targets.find((item) => item.id === id));
  const [tab, setTab] = useState<"connection" | "tools" | "skills">("connection");
  const [config, setConfig] = useState<EditorConfig | null>(null);
  useEffect(() => {
    let live = true;
    actions.getTarget(id).then((loaded: EditorConfig) => { if (live) setConfig(loaded); },
      (cause: unknown) => { if (live) setConfig({ id, label: id, loadError: cause instanceof Error ? cause.message : "实例配置读取失败。" }); });
    return () => { live = false; };
  }, [actions, id]);
  return <Flex id="instance-settings" className="instance-settings" direction="column" miw={0} mih={0} data-instance={id} data-embedded={onBack ? "true" : undefined}>
    <Flex component="header" align="center" gap={8} className="instance-settings-head">
      {onBack && <ActionIcon data-action="close-instance-settings" variant="subtle" color="gray" aria-label="返回" onClick={onBack}><IconChevronLeft size={18} /></ActionIcon>}
      {onBack && <Text component="strong" fw={700}>{labelForTarget(target)}</Text>}
      <Tabs value={tab} onChange={(value) => setTab(value === "tools" || value === "skills" ? value : "connection")} flex={1} miw={0}>
        <Tabs.List>
          <Tabs.Tab value="connection" data-instance-tab="connection">连接</Tabs.Tab>
          <Tabs.Tab value="tools" data-instance-tab="tools">工具</Tabs.Tab>
          <Tabs.Tab value="skills" data-instance-tab="skills">Skills</Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </Flex>
    {/* The connection form stays mounted while another tab is open, so unsaved edits survive a tab switch. */}
    <div className="instance-settings-pane" hidden={tab !== "connection"}>
      {config ? <TargetEditor actions={actions} existingId={id} initialConfig={config} onClose={onClose} /> : <Loader size="sm" />}
    </div>
    {/* The panel's optional props (session key, tool mode) are session-only; an instance page leaves them unset. */}
    {tab !== "connection" ? <CapabilitiesPanel key={tab} kind={tab} instance={id} actions={actions} mobile={mobile} localTools={undefined} initialProvider={undefined} /> : null}
  </Flex>;
}
