import type { FileMenuState } from "../file-tree/tree-types.ts";
import type { FileActionId } from "./file-action-types.ts";
import { useBackToClose } from "./use-back-to-close.ts";
import { Menu } from "@mantine/core";
import { Drawer } from "@mantine/core";
import { Text } from "@mantine/core";
import { UnstyledButton } from "@mantine/core";
import { Fragment } from "react";
import { ACTIONS } from "./file-action-groups.ts";
type FileMenuProps = { menu: FileMenuState | null; groups: FileActionId[][]; showHidden: boolean; onAction: (id: FileActionId) => void; onClose: () => void };

export function FileMenu({ menu, groups, showHidden, onAction, onClose }: FileMenuProps) {
  const sheet = Boolean(menu?.sheet);
  useBackToClose(sheet, onClose);
  const resolveAction = (id: FileActionId) => {
    const item = ACTIONS[id];
    if (id !== "toggleHidden" || !showHidden) return item;
    return { ...item, label: item.activeLabel ?? item.label, short: item.activeShort, icon: item.activeIcon ?? item.icon };
  };
  return <>
    {/* A fresh Menu per open: reopening while the previous one is still running its exit transition leaves the dropdown stuck hidden. */}
    <Menu key={menu && !sheet ? `${menu.x},${menu.y},${menu.entry?.path ?? ""}` : "closed"} opened={Boolean(menu) && !sheet} onChange={(opened) => { if (!opened) onClose(); }} position="bottom-start" offset={2} withinPortal
      middlewares={{ flip: true, shift: true, size: { padding: 8 } }}>
      {/* Exception to native layout: the menu opens at the pointer or at a button's corner as given by the caller; this empty
        anchor sits at those coordinates (Mantine's Menu takes an element, not bare coordinates). */}
      <Menu.Target><span className="pi-files-menu-anchor" style={{ left: menu?.x ?? 0, top: menu?.y ?? 0 }} aria-hidden="true" /></Menu.Target>
      <Menu.Dropdown className="pi-files-menu" aria-label={menu?.entry ? `${menu.entry.name} 的操作` : "当前目录的操作"}>
        {groups.map((group, index) => <Fragment key={index}>
          {index ? <Menu.Divider /> : null}
          {group.map((id) => {
            const { label, icon: Icon, danger } = resolveAction(id);
            return <Menu.Item key={id} data-action={id} color={danger ? "red" : undefined} leftSection={<Icon size={15} stroke={1.6} />} onClick={() => onAction(id)}>{label}</Menu.Item>;
          })}
        </Fragment>)}
      </Menu.Dropdown>
    </Menu>
    {/* returnFocus off: refocusing the ⋯ / + button would blur the inline name input the action just opened. */}
    <Drawer opened={sheet} onClose={onClose} position="bottom" withCloseButton={false} radius="lg" returnFocus={false} classNames={{ content: "pi-files-sheet" }}
      aria-label={menu?.entry ? `${menu.entry.name} 的操作` : "当前目录的操作"}>
      <Text fw={600} size="sm" px={4} pb={8} truncate>{menu?.entry ? menu.entry.name : "当前目录"}</Text>
      <div className="pi-files-sheet-grid">
        {groups.flat().map((id) => {
          const { label, short, icon: Icon, danger } = resolveAction(id);
          return <UnstyledButton key={id} data-action={id} className="pi-files-sheet-action" data-danger={danger || undefined} onClick={() => onAction(id)}>
            <Icon size={22} stroke={1.6} /><span>{short ?? label}</span>
          </UnstyledButton>;
        })}
      </div>
    </Drawer>
  </>;
}
