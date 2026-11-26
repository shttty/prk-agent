import { Group, Text } from "@mantine/core";
import type { CapturedRequest, PromptDiff } from "../../../src/gateway/wire/web-types.ts";
import { changeMark } from "./change-mark.ts";
import { PromptSection } from "./PromptSection.tsx";

type PromptToolsProps = { latest: CapturedRequest; diff: PromptDiff | null };

/** The tools of the request: name, description and parameter sizes, and what changed since the previous request. */
export function PromptTools({ latest, diff }: PromptToolsProps) {
  const { tools } = latest;
  if (!tools) return null;
  const delta = diff?.tools ?? null;
  const summary = `${tools.length} 个${delta?.reordered ? " · 顺序与上次不同" : ""}`;
  return <PromptSection title="工具" summary={summary} field="tools">
    {tools.map((tool) => <Group key={tool.name} gap={10} wrap="nowrap" px={8} py={5} data-tool-name={tool.name}>
      <Text size="sm" truncate flex={1}>{tool.name}</Text>
      <Text size="xs" c="dimmed" data-field="mark">{changeMark(delta, tool.name) ?? ""}</Text>
      <Text size="xs" c="dimmed" ta="right">描述 {tool.descriptionChars.toLocaleString()} · 参数 {tool.parametersChars.toLocaleString()}</Text>
    </Group>)}
    {(delta?.removed ?? []).map((tool) => <Group key={tool.key} gap={10} wrap="nowrap" px={8} py={5} data-tool-name={tool.key} data-removed="true">
      <Text size="sm" truncate flex={1} c="dimmed">{tool.key}</Text>
      <Text size="xs" c="dimmed">已移除</Text>
    </Group>)}
  </PromptSection>;
}
