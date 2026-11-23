import { Select } from "@mantine/core";
import { DELEGATION_LEVELS } from "./delegation-level.js";

/** 子会话档位 of this session (only rendered when the session reports `delegation`). A change calls native action
 * `delegation {level}` without a transcript card. */
export function DelegationSetting({ level, disabled, actions }) {
  return <Select
    id="chat-delegation-select"
    label="子会话档位"
    size="sm"
    data={DELEGATION_LEVELS.map((value) => ({ value, label: value }))}
    renderOption={({ option }) => <span data-delegation={option.value}>{option.label}</span>}
    value={level}
    onChange={(value) => { if (value && value !== level) void actions.executeNativeAction("delegation", { level: value }, { transcript: false }); }}
    disabled={disabled}
    allowDeselect={false}
    comboboxProps={{ withinPortal: true }}
  />;
}
