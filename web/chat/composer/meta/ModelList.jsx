import { Menu } from "@mantine/core";
import { Text } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useComposerSettings } from "./use-composer-settings.js";
/** Switchable models grouped by provider, current one checked; scrolls inside the model menu. Typing jumps to a
 * model by name prefix (Mantine Menu type-ahead). */
export function ModelList({ actions }) {
  const { models, modelValue, modelDisabled, modelCatalog } = useComposerSettings();
  const groups = Map.groupBy(models, (model) => model.provider);
  const choose = (value) => { if (value !== modelValue) void actions.executeNativeAction("model", { model: value }, { transcript: false }); };
  return (
    <div className="pi-model-list" data-setting-value={modelValue}>
      {[...groups].map(([provider, entries]) => (
        <div key={provider} role="group" aria-label={provider}>
          <Text className="pi-model-group" aria-hidden="true">{provider}</Text>
          {entries.map((model) => (
            <Menu.Item key={model.value} role="menuitemradio" aria-checked={model.value === modelValue} data-model-option={model.value} disabled={modelDisabled} title={model.value} leftSection={<span className="pi-setting-check">{model.value === modelValue ? <IconCheck size={14} stroke={2} /> : null}</span>} onClick={() => choose(model.value)}>{model.label}</Menu.Item>
          ))}
        </div>
      ))}
      {models.length ? null : <Menu.Item disabled>{modelCatalog.error ? "模型目录不可用" : modelCatalog.value ? "无可用模型" : "正在读取模型…"}</Menu.Item>}
    </div>
  );
}
