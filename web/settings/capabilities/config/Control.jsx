import { PrkSwitch } from "../../../design-system/switch/PrkSwitch.jsx";
import { Select } from "@mantine/core";
import { NumberInput } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { isSecret } from "./is-secret.js";
export function Control({ field, value, onChange }) {
  const scale = field.scale || 1;
  if (field.type === "boolean") return <PrkSwitch checked={value === true} aria-label={field.label} onChange={(event) => onChange(event.currentTarget.checked)} />;
  if (field.type === "select") return <Select className="config-input" data={field.options} value={value ?? null} aria-label={field.label} allowDeselect={false} onChange={(next) => onChange(next)} />;
  if (field.type === "number") return <span className="config-number">
    <NumberInput className="config-input" value={value === undefined ? "" : value / scale} min={field.min} decimalScale={scale === 1 ? undefined : 3} aria-label={field.label} hideControls
      onChange={(next) => { if (next !== "" && Number.isFinite(Number(next))) onChange(scale === 1 ? Number(next) : Math.round(Number(next) * scale)); }} />
    {field.unit ? <span className="config-unit">{field.unit}</span> : null}
  </span>;
  if (field.type === "list") {
    const items = Array.isArray(value) ? value : [];
    const numeric = field.itemType === "number";
    return <div className="config-list">
      {items.map((item, index) => <div className="config-list-item" key={index}>
        {numeric ? <NumberInput className="config-input" value={item / scale} hideControls aria-label={`${field.label} ${index + 1}`} onChange={(next) => { if (next !== "" && Number.isFinite(Number(next))) onChange(items.map((old, at) => at === index ? Math.round(Number(next) * scale) : old)); }} />
          : <TextInput className="config-input" value={item ?? ""} aria-label={`${field.label} ${index + 1}`} onChange={(event) => onChange(items.map((old, at) => at === index ? event.currentTarget.value : old))} />}
        {field.unit ? <span className="config-unit">{field.unit}</span> : null}
        <ActionIcon variant="subtle" color="gray" data-action="config-list-remove" aria-label="删除" onClick={() => onChange(items.filter((_, at) => at !== index))}><IconX size={14} /></ActionIcon>
      </div>)}
      <Button className="config-list-add" size="compact-xs" variant="subtle" data-action="config-list-add" leftSection={<IconPlus size={13} />} onClick={() => onChange([...items, numeric ? items.at(-1) ?? 0 : ""])}>添加一项</Button>
    </div>;
  }
  // Values the form cannot edit (null, arrays of objects) are shown as JSON, read-only.
  if (field.type === "json") return <TextInput className="config-input" value={JSON.stringify(value)} readOnly aria-label={field.label} />;
  if (isSecret(field)) return <TextInput className="config-input" type="password" autoComplete="off" spellCheck={false} value={value ?? ""} aria-label={field.label} onChange={(event) => onChange(event.currentTarget.value)} />;
  return <TextInput className="config-input" value={value ?? ""} spellCheck={false} aria-label={field.label} onChange={(event) => onChange(event.currentTarget.value)} />;
}
