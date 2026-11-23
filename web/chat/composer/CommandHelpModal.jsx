import "./commands/commands.css";
import { Modal } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { commandLabel } from "./commands/command-label.js";
export function CommandHelpModal({ command, onClose, onUse }) {
  const help = command?.help;
  const label = command ? commandLabel(command) : "";
  return (
    <Modal opened={Boolean(help)} onClose={onClose} title={<span className="pi-help-title">{label}</span>} centered size="lg" classNames={{ content: "pi-help-modal", body: "pi-help-body" }} closeButtonProps={{ "aria-label": "关闭说明" }}>
      {help ? <Stack gap="md">
        {command.summary ? <Text className="pi-help-summary">{command.summary}</Text> : null}
        {Array.isArray(help.usage) && help.usage.length ? <div className="pi-help-section"><Text className="pi-help-heading">用法</Text>{help.usage.map((line) => <code key={line} className="pi-help-usage">{line}</code>)}</div> : null}
        {Array.isArray(help.body) && help.body.length ? <div className="pi-help-section">{help.body.map((line) => <Text key={line} className="pi-help-text">{line}</Text>)}</div> : null}
        {Array.isArray(help.notes) && help.notes.length ? <div className="pi-help-section"><Text className="pi-help-heading">注意</Text><ul className="pi-help-notes">{help.notes.map((line) => <li key={line}>{line}</li>)}</ul></div> : null}
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>关闭</Button>
          <Button onClick={() => onUse(command)}>填入 {label}</Button>
        </Group>
      </Stack> : null}
    </Modal>
  );
}
