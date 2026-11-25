import { NativeSelect } from "@mantine/core";
import { IconLayoutRows } from "@tabler/icons-react";
import { useTurnFoldMode } from "../../chat/transcript/turns/use-turn-fold-mode.js";

const modes = [
  { value: "segmented", label: "正文常显，只折叠工具和思考" },
  { value: "whole", label: "整段折叠过程" },
];

export function TurnFoldSetting() {
  const [mode, setMode] = useTurnFoldMode();
  return <div className="pi-settings-row is-static">
    <span className="pi-settings-icon" aria-hidden="true"><IconLayoutRows size={16} stroke={1.7} /></span>
    <label className="pi-settings-title" htmlFor="setting-turn-fold-mode">助手回合折叠方式</label>
    <NativeSelect id="setting-turn-fold-mode" size="xs" value={mode} onChange={(event) => setMode(event.currentTarget.value)} data={modes} />
  </div>;
}
