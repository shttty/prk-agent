import "./commands/commands.css";
import { Fragment } from "react";
import { Modal } from "@mantine/core";
import { Kbd } from "@mantine/core";
import { SHORTCUTS } from "./commands/command-text.ts";
/** Small text-entry dialog; replaces window.prompt for labels and filters. */
export function ShortcutsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="快捷键" size={480} centered className="pi-help-modal" closeButtonProps={{ "aria-label": "关闭快捷键" }}>
      <dl className="pi-shortcuts">
        {SHORTCUTS.map(([keys, text]) => <Fragment key={keys}><dt><Kbd>{keys}</Kbd></dt><dd>{text}</dd></Fragment>)}
      </dl>
    </Modal>
  );
}
