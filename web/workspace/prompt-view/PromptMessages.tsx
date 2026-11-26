import { SimpleGrid, Stack, Text } from "@mantine/core";
import type { CapturedRequest, MessageChange, PromptDiff } from "../../../src/gateway/wire/web-types.ts";
import { PromptSection } from "./PromptSection.tsx";

type PromptMessagesProps = { latest: CapturedRequest; diff: PromptDiff | null };

/** The conversation: its count, and whether every earlier message is still in place (the prompt cache's condition). When it is not, the first message that differs is shown as it was and as it is. */
export function PromptMessages({ latest, diff }: PromptMessagesProps) {
  const { messages } = latest;
  if (!messages) return null;
  const change = diff?.messages ?? null;
  return <PromptSection title="消息" summary={`${messages.count.toLocaleString()} 条 · ${messages.chars.toLocaleString()} 字符`} field="messages">
    <Stack gap={8} px={8} data-prefix-stable={change ? String(change.prefixStable) : undefined} data-first-change={change?.firstChange ? change.firstChange.index : undefined}>
      <Text size="sm">{!change ? "还没有上一次请求可比较。" : change.prefixStable ? `前缀稳定：上次的 ${change.before} 条原样保留，新增 ${change.after - change.before} 条。` : `前缀不稳定：从第 ${change.commonPrefix + 1} 条开始与上次不同（上次 ${change.before} 条，这次 ${change.after} 条）。`}</Text>
      {change?.firstChange ? <SimpleGrid type="container" cols={{ base: 1, "30rem": 2 }} spacing="sm">
        <Side label="上次" change={change.firstChange} side="before" />
        <Side label="这次" change={change.firstChange} side="after" />
      </SimpleGrid> : null}
    </Stack>
  </PromptSection>;
}

type SideProps = { label: string; change: MessageChange; side: "before" | "after" };

function Side({ label, change, side }: SideProps) {
  const shown = change[side];
  const cut = shown && change.offset + shown.text.length < shown.chars;
  return <Stack gap={2} data-side={side} miw={0}>
    <Text size="xs" c="dimmed">{label} · 第 {change.index + 1} 条{shown ? ` · ${shown.chars.toLocaleString()} 字符` : ""}</Text>
    {shown ? <pre className="pi-prompt-text">{`${change.offset > 0 ? "…" : ""}${shown.text}${cut ? "…" : ""}`}</pre> : <Text size="xs" c="dimmed">{side === "after" ? "这次请求到这里就没有消息了。" : "上次请求里没有这一条。"}</Text>}
  </Stack>;
}
