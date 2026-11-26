import { Menu } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { useComposerSettings } from "./use-composer-settings.js";
// On the phone the list gets a filter box past this many models; the desktop always has one.
const FILTER_FROM = 9;
/** Switchable models grouped by provider, current one checked; scrolls inside the model menu. `filter` forces the filter box. */
export function ModelList({ actions, filter }) {
  const { models, modelValue, modelDisabled, modelCatalog } = useComposerSettings();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? models.filter((model) => `${model.provider}/${model.label}/${model.value}`.toLowerCase().includes(needle)) : models;
  const groups = Map.groupBy(shown, (model) => model.provider);
  const choose = (value) => { if (value !== modelValue) void actions.executeNativeAction("model", { model: value }, { transcript: false }); };
  return (
    <>
      {filter || models.length >= FILTER_FROM ? <Menu.Search className="pi-model-filter" placeholder="筛选模型" aria-label="筛选模型" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /> : null}
      <div className="pi-model-list" data-setting-value={modelValue}>
        {[...groups].map(([provider, entries]) => (
          <div key={provider} role="group" aria-label={provider}>
            <Text className="pi-model-group" aria-hidden="true">{provider}</Text>
            {entries.map((model) => (
              <Menu.Item key={model.value} role="menuitemradio" aria-checked={model.value === modelValue} data-model-option={model.value} disabled={modelDisabled} title={model.value} leftSection={<span className="pi-setting-check">{model.value === modelValue ? <IconCheck size={14} stroke={2} /> : null}</span>} onClick={() => choose(model.value)}>{model.label}</Menu.Item>
            ))}
          </div>
        ))}
        {models.length && !shown.length ? <Menu.Item disabled>没有匹配的可用模型</Menu.Item> : null}
        {models.length ? null : <Menu.Item disabled>{modelCatalog.error ? "模型目录不可用" : modelCatalog.value ? "无可用模型" : "正在读取模型…"}</Menu.Item>}
      </div>
    </>
  );
}
