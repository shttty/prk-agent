import { Group, Text, UnstyledButton } from "@mantine/core";
import type { MessageOutline } from "../../../src/gateway/wire/web-types.ts";
import { PromptText } from "./PromptText.tsx";
import { readableJson } from "./readable-json.ts";

type PromptMessageRowProps = { index: number; message: unknown; outline: MessageOutline; mark: string | null; open: boolean; onToggle: (index: number) => void };

/** One entry of the request's conversation: its place, role, kinds of block, size and cache marker; open, the entry in full as the provider received it. */
export function PromptMessageRow({ index, message, outline, mark, open, onToggle }: PromptMessageRowProps) {
  return <div data-message-index={index} data-open={open} data-role={outline.role} data-mark={mark ?? undefined}>
    <UnstyledButton className="pi-prompt-row" w="100%" px={8} py={5} aria-expanded={open} onClick={() => onToggle(index)}>
      <Group gap={10} wrap="nowrap">
        <Text size="xs" c="dimmed" w={36} ta="right">{index + 1}</Text>
        <Text size="sm" truncate flex={1}>{outline.role} · {outline.kinds.join(" ")}</Text>
        <Text size="xs" c="dimmed" data-field="mark">{[mark, outline.cache ? "cache" : null].filter(Boolean).join(" · ")}</Text>
        <Text size="xs" c="dimmed" w={72} ta="right">{outline.chars.toLocaleString()}</Text>
      </Group>
    </UnstyledButton>
    {open ? <PromptText text={readableJson(message)} copy={JSON.stringify(message, null, 2)} /> : null}
  </div>;
}
