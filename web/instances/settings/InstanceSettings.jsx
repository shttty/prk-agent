import { useState } from "react";
import { useEffect } from "react";
import { ActionIcon } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { labelForTarget } from "../../sessions/sidebar/labels/label-for-target.js";
import { Tabs } from "@mantine/core";
import { TargetEditor } from "../editor/TargetEditor.jsx";
import { Loader } from "@mantine/core";
import CapabilitiesPanel from "../../settings/capabilities/CapabilitiesPanel.jsx";
import "./instance-settings.css";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
/** One instance's settings: its connection config (the same editor) and default tool/Skills switches. Opened from the
 * sidebar group menu (a dialog) and from the settings window's instance page (`onBack` set: embedded with a back button). */
export function InstanceSettings({ actions, id, mobile, onClose, onBack }) {
  const target = useWorkbench((state) => state.targets.find((item) => item.id === id));
  const [tab, setTab] = useState("connection");
  const [config, setConfig] = useState(null);
  useEffect(() => {
    let live = true;
    actions.getTarget(id).then((target) => { if (live) setConfig(target); },
      (cause) => { if (live) setConfig({ id, label: id, loadError: cause instanceof Error ? cause.message : "实例配置读取失败。" }); });
    return () => { live = false; };
  }, [actions, id]);
  return <div id="instance-settings" className="instance-settings" data-instance={id} data-embedded={onBack ? "true" : undefined}>
    <header className="instance-settings-head">
      {onBack && <ActionIcon data-action="close-instance-settings" variant="subtle" color="gray" aria-label="返回" onClick={onBack}><IconChevronLeft size={18} /></ActionIcon>}
      {onBack && <strong className="instance-settings-name">{labelForTarget(target)}</strong>}
      <Tabs value={tab} onChange={setTab} className="instance-settings-tabs">
        <Tabs.List>
          <Tabs.Tab value="connection" data-instance-tab="connection">连接</Tabs.Tab>
          <Tabs.Tab value="tools" data-instance-tab="tools">工具</Tabs.Tab>
          <Tabs.Tab value="skills" data-instance-tab="skills">Skills</Tabs.Tab>
        </Tabs.List>
      </Tabs>
    </header>
    {/* The connection form stays mounted while another tab is open, so unsaved edits survive a tab switch. */}
    <div className="instance-settings-pane" hidden={tab !== "connection"}>
      {config ? <TargetEditor actions={actions} existingId={id} initialConfig={config} onClose={onClose} /> : <Loader size="sm" />}
    </div>
    {tab !== "connection" ? <CapabilitiesPanel key={tab} kind={tab} instance={id} actions={actions} mobile={mobile} /> : null}
  </div>;
}
