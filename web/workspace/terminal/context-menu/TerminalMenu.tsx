import { Menu } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconClipboard } from "@tabler/icons-react";
import { IconCopy } from "@tabler/icons-react";
import { IconSelectAll } from "@tabler/icons-react";
import { IconSearch } from "@tabler/icons-react";
import { IconQuote } from "@tabler/icons-react";

import type { TerminalAction, TerminalMenuState } from "../terminal-types.ts";

type TerminalMenuProps = { shell: string; menu: TerminalMenuState | null; onClose: () => void; onAction: (action: TerminalAction) => void; quotable: boolean };

const keys = (combo: string) => <kbd className="pi-term-menu-keys">{combo}</kbd>;

/** The terminal's right-click menu at the pointer (Konsole's copy / paste / select all / find, plus quoting the selection
 * into the session's composer when `quotable`). Mounted only while open, so every right click gets a fresh Menu. */
export function TerminalMenu({ shell, menu, onClose, onAction, quotable }: TerminalMenuProps) {
  if (!menu) return null;
  // Reading the clipboard needs a secure context; on plain http only the browser's own paste (Ctrl+Shift+V) works.
  const readable = window.isSecureContext && typeof navigator.clipboard?.readText === "function";
  return <Menu opened onChange={(opened) => { if (!opened) onClose(); }} position="bottom-start" offset={2} withinPortal
    middlewares={{ flip: true, shift: true, size: { padding: 8 } }}>
    {/* Exception to native layout: the menu opens at the pointer, which has no element to follow; this empty anchor sits at
        the click position inside the terminal view (Floating UI cannot take bare coordinates through Mantine's Menu). */}
    <Menu.Target><span className="pi-term-menu-anchor" style={{ left: menu.x, top: menu.y }} aria-hidden="true" /></Menu.Target>
    <Menu.Dropdown className="pi-term-menu" data-shell={shell} aria-label="终端操作">
      <Menu.Item data-action="copy" disabled={!menu.selection} leftSection={<IconCopy size={15} stroke={1.6} />} rightSection={keys("Ctrl+Shift+C")} onClick={() => onAction("copy")}>复制</Menu.Item>
      {quotable ? <Menu.Item data-action="quote" disabled={!menu.selection} leftSection={<IconQuote size={15} stroke={1.6} />} onClick={() => onAction("quote")}>引用到输入框</Menu.Item> : null}
      <Menu.Item data-action="paste" disabled={!readable} leftSection={<IconClipboard size={15} stroke={1.6} />} rightSection={keys("Ctrl+Shift+V")} onClick={() => onAction("paste")}>
        粘贴{readable ? null : <Text size="xs" c="dimmed" className="pi-term-menu-note">http 下浏览器不允许网页读取剪贴板，请用 Ctrl+Shift+V</Text>}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item data-action="select-all" leftSection={<IconSelectAll size={15} stroke={1.6} />} rightSection={keys("Ctrl+Shift+A")} onClick={() => onAction("selectAll")}>全选</Menu.Item>
      <Menu.Item data-action="find" leftSection={<IconSearch size={15} stroke={1.6} />} rightSection={keys("Ctrl+Shift+F")} onClick={() => onAction("find")}>查找</Menu.Item>
    </Menu.Dropdown>
  </Menu>;
}
