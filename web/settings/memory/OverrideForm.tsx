import type { ConfigDocument, ConfigLayer, LayerField, LayerValue, ReviewConfig } from "./memory-types.ts";
import { setField as withField } from "./set-field.ts";
import { Button } from "@mantine/core";
import { Group } from "@mantine/core";
import { NumberInput } from "@mantine/core";
import { Select } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import LayerCard from "./LayerCard.tsx";
import { layerLabel } from "./layer-label.ts";

const FOLLOW = "follow";
const reviewChoice = [{ value: FOLLOW, label: "跟随公共" }, { value: "on", label: "允许" }, { value: "off", label: "不允许" }];

/**
 * PRK's override as patches over the shared layers; fields the form does not show stay as they were.
 * `document` is the override TOML document, `shared` the shared one (for names and placeholders).
 */
type OverrideFormProps = { document: ConfigDocument; shared: ConfigDocument | undefined; onChange: (next: ConfigDocument) => void };

export default function OverrideForm({ document, shared, onChange }: OverrideFormProps) {
  const patches = Array.isArray(document.layers) ? document.layers : [];
  const sharedLayers = Array.isArray(shared?.layers) ? shared.layers : [];
  const sharedNames = new Set(sharedLayers.map((layer) => layer.name));
  const patchOf = (name: string | undefined): ConfigLayer => patches.find((patch) => patch.name === name) ?? { name };
  const setPatches = (next: ConfigLayer[]) => onChange({ ...document, layers: next.filter((patch) => Object.keys(patch).length > 1 || !sharedNames.has(patch.name)) });
  const setField = (name: string | undefined, field: LayerField, value: LayerValue) => {
    const patch = withField(patchOf(name), field, value);
    const rest = patches.filter((item) => item.name !== name);
    setPatches(patches.some((item) => item.name === name) ? patches.map((item) => item.name === name ? patch : item) : [...rest, patch]);
  };
  const review = document.review ?? {};
  const setReview = (field: keyof ReviewConfig, value: number | undefined) => {
    const next = withField(review, field, value);
    const { review: _old, ...rest } = document;
    onChange(Object.keys(next).length ? { ...rest, review: next } : rest);
  };
  const own = patches.filter((patch) => !sharedNames.has(patch.name));
  return <Stack gap="md" id="memory-override-form">
    <Group gap="md" wrap="wrap">
      {(["userTurns", "toolCalls"] as const).map((field) => <NumberInput key={field} size="xs" w={160} min={1} max={1000} allowDecimal={false} data-field={`review-${field}`}
        label={field === "userTurns" ? "复盘：用户输入次数" : "复盘：工具调用次数"} placeholder={String(shared?.review?.[field] ?? "")}
        value={review[field] ?? ""} onChange={(value) => setReview(field, typeof value === "number" ? value : undefined)} />)}
    </Group>
    {sharedLayers.map((layer) => {
      const patch = patchOf(layer.name);
      return <section className="memory-layer-card" key={layer.name} data-override-layer={layer.name}>
        <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={600}>{layerLabel(layer.name ?? "")}</Text>
          <PrkSwitch checked={patch.enabled !== false} aria-label={`${layer.name} 启用`} data-field="enabled" onChange={(event) => setField(layer.name, "enabled", event.currentTarget.checked ? undefined : false)} /></Group>
        <Group gap="md" wrap="wrap">
          <NumberInput size="xs" w={140} label="容量（字符）" min={1} max={32000} allowDecimal={false} placeholder={String(layer.capacityCharacters ?? "")} data-field="capacityCharacters"
            value={patch.capacityCharacters ?? ""} onChange={(value) => setField(layer.name, "capacityCharacters", typeof value === "number" ? value : undefined)} />
          <Select size="xs" w={140} label="复盘" data={reviewChoice} allowDeselect={false} data-field="review"
            value={patch.review === undefined ? FOLLOW : patch.review ? "on" : "off"} onChange={(value) => setField(layer.name, "review", value === FOLLOW ? undefined : value === "on")} />
        </Group>
      </section>;
    })}
    {own.map((patch) => {
      const index = patches.indexOf(patch);
      return <LayerCard key={index} layer={patch} index={index} count={patches.length}
        onChange={(field, value) => setPatches(patches.map((item, at) => (at === index ? withField(item, field, value) : item)))}
        onRemove={() => setPatches(patches.filter((_, at) => at !== index))} />;
    })}
    <Group><Button size="compact-sm" variant="default" data-action="override-add-layer" onClick={() => setPatches([...patches, { name: "", path: "", description: "", capacityCharacters: 2000 }])}>新增 PRK 专用层</Button></Group>
  </Stack>;
}
