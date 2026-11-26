import type { ReactNode } from "react";
import { Group, Stack, Text } from "@mantine/core";

type PromptSectionProps = { title: string; summary: string; field: string; children?: ReactNode };

/** One block of the prompt viewer: a title with a one-line summary, then its rows. */
export function PromptSection({ title, summary, field, children }: PromptSectionProps) {
  return <Stack gap={4} data-field={field}>
    <Group gap={8} align="baseline" wrap="nowrap" px={8}>
      <Text size="sm" fw={600}>{title}</Text>
      <Text size="xs" c="dimmed" truncate>{summary}</Text>
    </Group>
    {children}
  </Stack>;
}
