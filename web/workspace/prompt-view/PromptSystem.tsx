import { Group, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import type { CapturedRequest, PromptDiff } from "../../../src/gateway/wire/web-types.ts";
import { changeMark } from "./change-mark.ts";
import { PromptSection } from "./PromptSection.tsx";
import { PromptText } from "./PromptText.tsx";

type PromptSystemProps = { latest: CapturedRequest; diff: PromptDiff | null };

/** The system prompt by section: key, size and what changed since the previous request; a row opens that section's full text. */
export function PromptSystem({ latest, diff }: PromptSystemProps) {
  const [open, setOpen] = useState<string | null>(null);
  const { system } = latest;
  if (!system) return <PromptSection title="系统提示" summary={`${latest.api} 的请求体不解析，只知道总长。`} field="system" />;
  const sections = system.sections;
  const rows = sections ? [...(sections.baseChars > 0 ? [{ key: "正文", chars: sections.baseChars, start: 0 }] : []), ...sections.entries] : [{ key: "全文", chars: system.chars, start: 0 }];
  const removed = diff?.sections?.removed ?? [];
  const same = diff?.system ? (diff.system.changed ? " · 与上次不同" : " · 与上次相同") : "";
  const note = sections ? "" : " · 与本轮渲染结果不一致（provider 改写了文本），不分段";
  return <PromptSection title="系统提示" summary={`${system.chars.toLocaleString()} 字符${same}${note}`} field="system">
    {rows.map((row) => {
      const mark = changeMark(diff?.sections, row.key);
      return <div key={row.key} data-section-key={row.key}>
        <UnstyledButton className="pi-prompt-row" w="100%" px={8} py={5} aria-expanded={open === row.key} onClick={() => setOpen(open === row.key ? null : row.key)}>
          <Group gap={10} wrap="nowrap">
            <Text size="sm" truncate flex={1}>{row.key}</Text>
            <Text size="xs" c="dimmed" data-field="mark">{mark ?? ""}</Text>
            <Text size="xs" c="dimmed" w={72} ta="right">{row.chars.toLocaleString()}</Text>
          </Group>
        </UnstyledButton>
        {open === row.key ? <PromptText text={system.text.slice(row.start, row.start + row.chars)} /> : null}
      </div>;
    })}
    {removed.map((entry) => <Group key={entry.key} gap={10} wrap="nowrap" px={8} py={5} data-section-key={entry.key} data-removed="true">
      <Text size="sm" truncate flex={1} c="dimmed">{entry.key}</Text>
      <Text size="xs" c="dimmed">已移除</Text>
      <Text size="xs" c="dimmed" w={72} ta="right">{entry.chars.toLocaleString()}</Text>
    </Group>)}
  </PromptSection>;
}
