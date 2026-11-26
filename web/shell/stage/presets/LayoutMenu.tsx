import type { Preset } from "./preset-types.ts";
import { useState } from "react";
import { Menu } from "@mantine/core";
import { Tooltip } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { CloseButton } from "@mantine/core";
import { IconLayoutDashboard } from "@tabler/icons-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { BUILTIN_PRESETS } from "./builtin-presets.ts";
import { useSavedPresets } from "./use-saved-presets.ts";
import { SaveLayoutDialog } from "./SaveLayoutDialog.tsx";

/** The layout button in the stage's control group: built-in layouts, the user's saved ones (each with its delete
 * button), and saving the current arrangement under a name. A pick applies at once. `onApply(layout, id)`;
 * `onCapture()` returns the current arrangement. */
type LayoutMenuProps = { onApply: (layout: Preset, id: string) => void; onCapture: () => Preset };

export function LayoutMenu({ onApply, onCapture }: LayoutMenuProps) {
  const { saved, add, remove } = useSavedPresets();
  const [naming, setNaming] = useState<Preset | null>(null); // the arrangement being named
  const [opened, setOpened] = useState(false);
  return <>
    <Menu id="layout-presets" position="bottom-end" shadow="md" width={220} opened={opened} onChange={setOpened}>
      <Tooltip label="布局" disabled={opened}><Menu.Target><ActionIcon variant="subtle" color="gray" aria-label="布局"><IconLayoutDashboard size={17} /></ActionIcon></Menu.Target></Tooltip>
      <Menu.Dropdown>
        {BUILTIN_PRESETS.map((preset) => <Menu.Item key={preset.id} data-action="apply-layout" data-preset={preset.id} onClick={() => onApply(preset.layout, preset.id)}>{preset.name}</Menu.Item>)}
        {saved.length ? <Menu.Divider /> : null}
        {saved.map((entry) => <Menu.Item key={entry.name} data-action="apply-layout" data-preset={`saved:${entry.name}`} onClick={() => onApply(entry.layout, `saved:${entry.name}`)}
          rightSection={<CloseButton size="sm" component="span" data-action="delete-layout" aria-label={`删除布局 ${entry.name}`} onClick={(event) => { event.stopPropagation(); remove(entry.name); }} />}>{entry.name}</Menu.Item>)}
        <Menu.Divider />
        <Menu.Item id="save-layout" leftSection={<IconDeviceFloppy size={15} />} onClick={() => setNaming(onCapture())}>保存当前布局…</Menu.Item>
      </Menu.Dropdown>
    </Menu>
    <SaveLayoutDialog opened={Boolean(naming)} saved={saved} onCancel={() => setNaming(null)} onSave={(name) => { if (naming) add(name, naming); setNaming(null); }} />
  </>;
}
