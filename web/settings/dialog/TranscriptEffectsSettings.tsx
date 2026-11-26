import type { Icon } from "@tabler/icons-react";
import { IconBrain, IconChevronDown, IconTextCaption, IconTool } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { useTranscriptEffects } from "../../chat/transcript/use-transcript-effects.js";

const properties: { key: "showThinking" | "expandTools" | "expandThinking" | "streamOutput"; id: string; label: string; Icon: Icon }[] = [
  { key: "showThinking", id: "setting-show-thinking", label: "显示思考", Icon: IconBrain },
  { key: "expandTools", id: "setting-expand-tools", label: "工具调用过程自动展开", Icon: IconTool },
  { key: "expandThinking", id: "setting-expand-thinking", label: "思考详情默认展开", Icon: IconChevronDown },
  { key: "streamOutput", id: "setting-stream-output", label: "流式输出", Icon: IconTextCaption },
];

export function TranscriptEffectsSettings() {
  const preferences = useTranscriptEffects();
  return properties.map(({ key, id, label, Icon }) => {
    const [enabled, setEnabled] = preferences[key];
    return <div key={id} className="pi-settings-row is-static">
      <span className="pi-settings-icon" aria-hidden="true"><Icon size={16} stroke={1.7} /></span>
      <label className="pi-settings-title" htmlFor={id}>{label}</label>
      <PrkSwitch id={id} checked={enabled} onChange={(event) => setEnabled(event.currentTarget.checked)} />
    </div>;
  });
}
