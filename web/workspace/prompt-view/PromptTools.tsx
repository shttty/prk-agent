import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import type { CapturedRequest, PromptDiff, PromptToolsPart } from "../../../src/gateway/wire/web-types.ts";
import { useEditorContext } from "../file-editor/use-editor-context.ts";
import { changeMark } from "./change-mark.ts";
import { PromptSection } from "./PromptSection.tsx";
import { PromptText } from "./PromptText.tsx";
import { readableJson } from "./readable-json.ts";

type PromptToolsProps = { latest: CapturedRequest; diff: PromptDiff | null };

/** The tools of the request: name, sizes and what changed since the previous request; a row opens the declaration as the provider received it (read once, on the first opening). */
export function PromptTools({ latest, diff }: PromptToolsProps) {
  const { loadPromptPart } = useEditorContext();
  const [open, setOpen] = useState<string | null>(null);
  const [part, setPart] = useState<PromptToolsPart | "error" | null>(null);
  const { tools } = latest;
  if (!tools) return null;
  const delta = diff?.tools ?? null;
  const summary = `${tools.length} 个${delta?.reordered ? " · 顺序与上次不同" : ""}`;
  const toggle = (name: string) => {
    setOpen(open === name ? null : name);
    if (part === null) void loadPromptPart<PromptToolsPart>("tools").then(setPart, () => setPart("error"));
  };
  const detail = (name: string) => {
    if (part === null) return <Text size="xs" c="dimmed" px={8}>读取中…</Text>;
    const tool = part === "error" ? undefined : part.tools.find((entry) => entry.name === name);
    if (!tool) return <Text size="xs" c="dimmed" px={8}>读不到这个工具的声明，请刷新。</Text>;
    return <Stack gap={2} data-field="declaration">
      <Text size="xs" c="dimmed" px={8} data-field="exposure">exposure {tool.exposure ?? "未知"} · 已在请求里原生声明</Text>
      <PromptText text={readableJson(tool.declaration)} copy={JSON.stringify(tool.declaration, null, 2)} />
    </Stack>;
  };
  return <PromptSection title="工具" summary={summary} field="tools">
    {tools.map((tool) => <div key={tool.name} data-tool-name={tool.name}>
      <UnstyledButton className="pi-prompt-row" w="100%" px={8} py={5} aria-expanded={open === tool.name} onClick={() => toggle(tool.name)}>
        <Group gap={10} wrap="nowrap">
          <Text size="sm" truncate flex={1}>{tool.name}</Text>
          <Text size="xs" c="dimmed" data-field="mark">{changeMark(delta, tool.name) ?? ""}</Text>
          <Text size="xs" c="dimmed" ta="right">描述 {tool.descriptionChars.toLocaleString()} · 参数 {tool.parametersChars.toLocaleString()}</Text>
        </Group>
      </UnstyledButton>
      {open === tool.name ? detail(tool.name) : null}
    </div>)}
    {(delta?.removed ?? []).map((tool) => <Group key={tool.key} gap={10} wrap="nowrap" px={8} py={5} data-tool-name={tool.key} data-removed="true">
      <Text size="sm" truncate flex={1} c="dimmed">{tool.key}</Text>
      <Text size="xs" c="dimmed">已移除</Text>
    </Group>)}
  </PromptSection>;
}
