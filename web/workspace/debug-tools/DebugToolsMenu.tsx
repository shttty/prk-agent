import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconBug } from "@tabler/icons-react";
import { useState } from "react";
import type { Engine } from "../editor-dock/engine/engine-types.ts";
import { DEBUG_TOOLS } from "./debug-tool-table.ts";
import { useDebugModePreference } from "./use-debug-mode-preference.ts";

type DebugToolsMenuProps = { engine: Engine | null; onOpened?: () => void };

/** The workspace bar's debug tools dropdown; it renders only while debug mode is on. `onOpened`: a tool was picked and shown. */
export function DebugToolsMenu({ engine, onOpened }: DebugToolsMenuProps) {
  const [enabled] = useDebugModePreference();
  const [opened, setOpened] = useState(false);
  if (!enabled) return null;
  return <Menu id="debug-tools-menu" position="bottom-end" shadow="md" width={160} opened={opened} onChange={setOpened}>
    <Tooltip label="调试工具" disabled={opened}><Menu.Target><ActionIcon data-action="debug-tools" size={26} variant="subtle" color="gray" aria-label="调试工具"><IconBug size={17} /></ActionIcon></Menu.Target></Tooltip>
    <Menu.Dropdown>
      <Menu.Label>调试工具</Menu.Label>
      {DEBUG_TOOLS.map((tool) => <Menu.Item key={tool.id} data-action="open-debug-tool" data-tool={tool.id} disabled={!engine} onClick={() => { if (engine) { tool.open(engine); onOpened?.(); } }}>{tool.label}</Menu.Item>)}
    </Menu.Dropdown>
  </Menu>;
}
