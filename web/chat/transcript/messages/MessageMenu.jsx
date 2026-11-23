import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { ActionIcon } from "@mantine/core";
import { Menu } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
/** The message "…" button; MessageActions shows it alone until the first click mounts MessageMenu around it. */
// React 19: `ref` arrives as a prop and is spread onto the ActionIcon (Menu.Target needs it).
export function MessageMenuButton(props) {
  return <ActionIcon data-action="message-menu" variant="subtle" size="sm" aria-label="消息操作" title="消息操作" {...props}><IconDots size={16} /></ActionIcon>;
}

/**
 * Mounted by the first click on the bare button, which this one replaces: take focus, then open. Mantine records the
 * element to return focus to when `opened` changes, so opening on mount would leave focus on the body after close.
 */
export function MessageMenu({ text, onQuote }) {
  const [opened, setOpened] = useState(false);
  const target = useRef(null);
  useEffect(() => {
    target.current?.focus();
    setOpened(true);
  }, []);
  return (
    <Menu opened={opened} onChange={setOpened} withinPortal position="bottom-end" shadow="sm">
      <Menu.Target><MessageMenuButton ref={target} /></Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onQuote} disabled={!text}>引用</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
