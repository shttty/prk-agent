import { IconBrain, IconChevronDown, IconTextCaption, IconTool } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";
import { useTranscriptEffects } from "../../chat/transcript/use-transcript-effects.js";

const properties = [
  ["showThinking", "setting-show-thinking", "显示思考", IconBrain],
  ["expandTools", "setting-expand-tools", "工具调用过程自动展开", IconTool],
  ["expandThinking", "setting-expand-thinking", "思考详情默认展开", IconChevronDown],
  ["streamOutput", "setting-stream-output", "流式输出", IconTextCaption],
];

export function TranscriptEffectsSettings() {
  const preferences = useTranscriptEffects();
  return properties.map(([key, id, label, Icon]) => {
    const [enabled, setEnabled] = preferences[key];
    return <div key={id} className="pi-settings-row is-static">
      <span className="pi-settings-icon" aria-hidden="true"><Icon size={16} stroke={1.7} /></span>
      <label className="pi-settings-title" htmlFor={id}>{label}</label>
      <PrkSwitch id={id} checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
    </div>;
  });
}
