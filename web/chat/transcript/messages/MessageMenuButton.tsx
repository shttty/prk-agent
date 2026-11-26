import { ActionIcon } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import type { ComponentPropsWithRef } from "react";
/** The message "…" button; MessageActions shows it alone until the first click mounts MessageMenu around it. */
// React 19: `ref` arrives as a prop and is spread onto the ActionIcon (Menu.Target needs it).
export function MessageMenuButton(props: ComponentPropsWithRef<"button">) {
  return <ActionIcon data-action="message-menu" variant="subtle" size="sm" aria-label="消息操作" title="消息操作" {...props}><IconDots size={16} /></ActionIcon>;
}
