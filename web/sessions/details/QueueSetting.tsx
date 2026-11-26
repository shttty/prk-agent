import { Select } from "@mantine/core";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import { QUEUE_LABELS } from "../../chat/composer/composer-constants.js";

/** How a message sent while a reply runs is delivered by default (workbench state `queue`, as before: page memory).
 * Ctrl/Cmd+Enter still reverses it for one message. */
type QueueSettingProps = { queue: string; disabled: boolean; actions: WorkbenchActions };

export function QueueSetting({ queue, disabled, actions }: QueueSettingProps) {
  return <Select
    id="queue-select"
    label="运行中发消息"
    description="Ctrl/Cmd+Enter 单条反转"
    size="sm"
    value={queue}
    onChange={(value) => value && actions.setQueue(value)}
    data={Object.entries(QUEUE_LABELS).map(([value, label]) => ({ value, label }))}
    disabled={disabled}
    allowDeselect={false}
    comboboxProps={{ withinPortal: true }}
  />;
}
