import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { Menu } from "@mantine/core";
import { MessageMenuButton } from "./MessageMenuButton.tsx";
/**
 * Mounted by the first click on the bare button, which this one replaces: take focus, then open. Mantine records the
 * element to return focus to when `opened` changes, so opening on mount would leave focus on the body after close.
 */
export function MessageMenu({ text, onQuote }: { text: string; onQuote: () => void }) {
  const [opened, setOpened] = useState(false);
  const target = useRef<HTMLButtonElement>(null);
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
