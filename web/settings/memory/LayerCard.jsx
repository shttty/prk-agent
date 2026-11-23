import { Group } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { NumberInput } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Textarea } from "@mantine/core";
import { Checkbox } from "@mantine/core";
import { IconArrowUp } from "@tabler/icons-react";
import { IconArrowDown } from "@tabler/icons-react";
import { IconTrash } from "@tabler/icons-react";

const FLAGS = [["soft", "超出只提醒"], ["explicitOnly", "仅明确要求时写"], ["review", "允许复盘写"]];

/** One layer's fields. `onChange(field, value)` with `undefined` removes the field. */
export default function LayerCard({ layer, index, count, onChange, onMove, onRemove }) {
  const id = `memory-layer-${index}`;
  return <section className="memory-layer-card" id={id} data-layer-card={index} data-name={layer.name ?? ""}>
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <TextInput className="memory-layer-name" label="名称" size="xs" value={layer.name ?? ""} data-field="name" onChange={(event) => onChange("name", event.currentTarget.value)} />
      <Group gap={2} wrap="nowrap">
        {onMove ? <><ActionIcon variant="subtle" size="sm" aria-label="上移" data-action="layer-up" disabled={index === 0} onClick={() => onMove(-1)}><IconArrowUp size={14} /></ActionIcon>
          <ActionIcon variant="subtle" size="sm" aria-label="下移" data-action="layer-down" disabled={index === count - 1} onClick={() => onMove(1)}><IconArrowDown size={14} /></ActionIcon></> : null}
        <ActionIcon variant="subtle" color="red" size="sm" aria-label="删除层" data-action="layer-remove" onClick={onRemove}><IconTrash size={14} /></ActionIcon>
      </Group>
    </Group>
    <TextInput label="文件路径" size="xs" value={layer.path ?? ""} data-field="path" placeholder="~/memories/name.md" onChange={(event) => onChange("path", event.currentTarget.value)} />
    <Textarea label="说明" size="xs" autosize minRows={1} maxRows={4} value={layer.description ?? ""} data-field="description" onChange={(event) => onChange("description", event.currentTarget.value)} />
    <Group gap="md" align="flex-end" wrap="wrap">
      <NumberInput label="容量（字符）" size="xs" w={140} min={1} max={32000} allowDecimal={false} value={layer.capacityCharacters ?? ""} data-field="capacityCharacters"
        onChange={(value) => onChange("capacityCharacters", typeof value === "number" ? value : undefined)} />
      {FLAGS.map(([field, label]) => <Checkbox key={field} size="xs" label={label} checked={layer[field] === true} data-field={field}
        onChange={(event) => onChange(field, event.currentTarget.checked ? true : undefined)} />)}
    </Group>
  </section>;
}
