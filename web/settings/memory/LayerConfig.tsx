import type { PageApi } from "../../shell/page/page-types.ts";
import type { ConfigDocument, ConfigLayer, ConfigView } from "./memory-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { setField } from "./set-field.ts";
import { useCallback } from "react";
import { useEffect } from "react";
import { useState } from "react";
import { Button } from "@mantine/core";
import { Collapse } from "@mantine/core";
import { Group } from "@mantine/core";
import { NumberInput } from "@mantine/core";
import { SegmentedControl } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { TextInput } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import LayerCard from "./LayerCard.tsx";
import OverrideForm from "./OverrideForm.tsx";
import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.js";
import { useRelink } from "../list-page/use-relink.ts";

/** Form editor for localmemory.toml and PRK's override; saves are refused if the file changed since it was loaded. */
type ConfigFile = "shared" | "override";

type ConfigError = { message: string; conflict?: boolean };

export default function LayerConfig({ api, onSaved }: { api: PageApi; onSaved: () => void }) {
  const [file, setFile] = useState<ConfigFile>("shared");
  const [views, setViews] = useState<Partial<Record<ConfigFile, ConfigView>>>({});
  const [drafts, setDrafts] = useState<Partial<Record<ConfigFile, ConfigDocument>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ConfigError | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const read = (which: ConfigFile): Promise<ConfigView> => api.post("/memory/config/get", { file: which });
      const [shared, override] = await Promise.all([read("shared"), read("override")]);
      setViews({ shared, override });
      setDrafts({ shared: shared.document ?? { layers: [] }, override: override.document ?? {} });
    } catch (cause) { if (pageErrorMessage(cause)) setError({ message: toFailure(cause).message }); }
    finally { setBusy(false); }
  }, [api]);
  useEffect(() => { void load(); }, [load]);
  useRelink(load);

  const view = views[file];
  const draft = drafts[file];
  const change = (next: ConfigDocument) => setDrafts((current) => ({ ...current, [file]: next }));
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const saved: ConfigView = await api.post("/memory/config/save", { file, document: draft, hash: view?.hash });
      setViews((current) => ({ ...current, [file]: saved }));
      setDrafts((current) => ({ ...current, [file]: saved.document ?? {} }));
      onSaved();
    } catch (cause) { if (pageErrorMessage(cause)) { const failure = toFailure(cause); setError({ message: failure.message, conflict: failure.code === "CONFLICT" }); } }
    finally { setBusy(false); }
  };

  const layers: ConfigLayer[] = draft?.layers ?? [];
  const setLayers = (next: ConfigLayer[]) => change({ ...draft, layers: next });
  const review = draft?.review ?? {};
  return <Stack gap="md" id="memory-config" data-file={file} aria-busy={busy}>
    <SegmentedControl id="memory-config-file" value={file} onChange={(value) => { setFile(value === "override" ? "override" : "shared"); setError(null); }}
      data={[{ label: "公共", value: "shared" }, { label: "PRK", value: "override" }]} />
    {view ? <Text size="xs" c="dimmed" id="memory-config-path" data-exists={String(view.exists)}>{view.path}</Text> : null}
    {view?.error ? <InlineAlert size="sm" id="memory-config-parse-error">{view.error}</InlineAlert> : null}
    {error ? <InlineAlert size="sm" id="memory-config-save-error" data-conflict={String(Boolean(error.conflict))}>{error.message}</InlineAlert> : null}
    {draft && file === "shared" ? <Stack gap="md" id="memory-shared-form">
      <TextInput size="xs" label="项目目录" value={draft.projectsDirectory ?? ""} placeholder="~/memories/projects" data-field="projectsDirectory"
        onChange={(event) => change(setField(draft, "projectsDirectory", event.currentTarget.value || undefined))} />
      <Group gap="md" align="flex-end" wrap="wrap">
        <PrkSwitch checked={review.enabled !== false} aria-label="后台复盘" data-field="review-enabled" onChange={(event) => change({ ...draft, review: setField(review, "enabled", event.currentTarget.checked ? undefined : false) })} />
        {(["userTurns", "toolCalls"] as const).map((field) => <NumberInput key={field} size="xs" w={160} min={1} max={1000} allowDecimal={false} data-field={`review-${field}`}
          label={field === "userTurns" ? "复盘：用户输入次数" : "复盘：工具调用次数"} placeholder={field === "userTurns" ? "10" : "15"} value={review[field] ?? ""}
          onChange={(value) => change({ ...draft, review: setField(review, field, typeof value === "number" ? value : undefined) })} />)}
      </Group>
      {layers.map((layer, index) => <LayerCard key={index} layer={layer} index={index} count={layers.length}
        onChange={(field, value) => setLayers(layers.map((item, at) => at === index ? setField(item, field, value) : item))}
        onMove={(step) => { const next = [...layers]; const other = next[index + step]; const mine = next[index]; if (!other || !mine) return; next[index] = other; next[index + step] = mine; setLayers(next); }}
        onRemove={() => setLayers(layers.filter((_, at) => at !== index))} />)}
      <Group><Button size="compact-sm" variant="default" data-action="shared-add-layer" onClick={() => setLayers([...layers, { name: "", path: "", description: "", capacityCharacters: 2000 }])}>新增层</Button></Group>
    </Stack> : null}
    {draft && file === "override" ? <OverrideForm document={draft} shared={drafts.shared} onChange={change} /> : null}
    <Group justify="space-between">
      <Button size="compact-sm" variant="subtle" id="memory-config-raw-toggle" onClick={() => setRawOpen((open) => !open)}>{rawOpen ? "收起原文" : "查看原文"}</Button>
      <Group gap="xs">
        {error?.conflict ? <Button size="xs" variant="default" id="memory-config-reload" disabled={busy} onClick={() => void load()}>重新载入</Button> : null}
        <Button size="xs" id="memory-config-save" loading={busy} disabled={!draft || !view} onClick={() => void save()}>保存</Button>
      </Group>
    </Group>
    <Collapse expanded={rawOpen}><pre className="memory-config-raw" id="memory-config-raw">{view?.raw ?? ""}</pre></Collapse>
  </Stack>;
}
