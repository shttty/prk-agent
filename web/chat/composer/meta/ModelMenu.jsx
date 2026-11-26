import { Menu } from "@mantine/core";
import { UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { IconChevronLeft } from "@tabler/icons-react";
import { IconChevronRight } from "@tabler/icons-react";
import { IconSelector } from "@tabler/icons-react";
import { useState } from "react";
import { ModelList } from "./ModelList.jsx";
import { SettingChoices } from "./SettingChoices.jsx";
import { useComposerSettings } from "./use-composer-settings.js";
const TITLES = { thinking: "思考等级", toolMode: "工具模式" };
/**
 * The model pill and its menu: models by provider, then entries for the settings that have no pill of their own
 * (`folded`). On the phone those entries switch the same dropdown to their values (with a way back); on the desktop
 * they open a side submenu.
 */
export function ModelMenu({ actions, tier, folded }) {
  const settings = useComposerSettings();
  const { modelCatalog, modelValue, selectedModel } = settings;
  const [panel, setPanel] = useState(null);
  const phone = tier === "phone";
  const current = { thinking: settings.thinkingLevel, toolMode: settings.toolMode };
  const disabled = settings.modelDisabled && folded.every((kind) => (kind === "thinking" ? settings.thinkingDisabled : settings.toolModeDisabled));
  const label = selectedModel ? selectedModel.label : modelValue || (modelCatalog.error ? "模型目录不可用" : modelCatalog.value ? "无可用模型" : "正在读取模型…");
  const entryLabel = (kind) => <span className="pi-setting-entry"><span>{TITLES[kind]}</span><span className="pi-setting-entry-value">{current[kind] || "未知"}</span></span>;
  const entry = (kind) => phone
    ? <Menu.Item key={kind} data-action={`open-${kind === "thinking" ? "thinking-levels" : "tool-modes"}`} closeMenuOnClick={false} rightSection={<IconChevronRight size={14} stroke={1.8} />} onClick={() => setPanel(kind)}>{entryLabel(kind)}</Menu.Item>
    : <Menu.Sub key={kind} position="right-end" offset={4}>
      <Menu.Sub.Target><Menu.Sub.Item data-action={`open-${kind === "thinking" ? "thinking-levels" : "tool-modes"}`}>{entryLabel(kind)}</Menu.Sub.Item></Menu.Sub.Target>
      <Menu.Sub.Dropdown className="pi-model-menu pi-setting-submenu"><SettingChoices kind={kind} actions={actions} /></Menu.Sub.Dropdown>
    </Menu.Sub>;
  return (
    // Menu.Target overwrites its child's id with the menu id, so the stable id lives on Menu.
    <Menu id="chat-model-select" position="top-start" offset={8} withinPortal shadow="md" width={phone ? 280 : 300} onClose={() => setPanel(null)}>
      <Menu.Target>
        <UnstyledButton type="button" className="pi-setting-pill pi-model-pill" data-setting-value={modelValue} title={modelValue || "当前模型未知"} aria-label={`当前模型：${label}`} disabled={disabled}>
          <span className="pi-setting-pill-text">{label}</span>
          {phone ? <IconSelector size={13} stroke={1.8} /> : <IconChevronDown size={12} stroke={1.8} />}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown className="pi-model-menu" data-panel={panel || "models"}>
        {panel ? <>
          <Menu.Item className="pi-setting-back" data-action="close-setting-panel" closeMenuOnClick={false} leftSection={<IconChevronLeft size={14} stroke={1.8} />} onClick={() => setPanel(null)}>{TITLES[panel]}</Menu.Item>
          <Menu.Divider />
          <SettingChoices kind={panel} actions={actions} />
        </> : <>
          <ModelList actions={actions} />
          {folded.length ? <Menu.Divider /> : null}
          {folded.map(entry)}
        </>}
      </Menu.Dropdown>
    </Menu>
  );
}
