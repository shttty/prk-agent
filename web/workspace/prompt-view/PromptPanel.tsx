import { Button, Group, Loader, Stack, Text } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import type { DockviewPanelApi } from "dockview-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { useVisible } from "../editor-dock/use-visible.ts";
import { PromptMessages } from "./PromptMessages.tsx";
import { PromptSystem } from "./PromptSystem.tsx";
import { PromptTools } from "./PromptTools.tsx";
import { usePromptReport } from "./use-prompt-report.ts";
import "../file-editor/file-editor.css";
import "./prompt-view.css";

/** The debug tool that shows what the session last sent to its model: system sections, tools and messages, each compared with the request before it. Read when first shown and on refresh. */
export function PromptPanel({ api }: { api: DockviewPanelApi }) {
  const { state, reload } = usePromptReport(useVisible(api));
  const report = state.status === "ok" ? state.report : null;
  const latest = report?.latest ?? null;
  const summary = latest ? `${latest.model} · ${latest.payloadChars.toLocaleString()} 字符 · ${new Date(latest.at).toLocaleTimeString()}${report?.diff?.modelChanged ? " · 模型与上次不同" : ""}` : "";
  return <section className="pi-file pi-prompt" data-panel="prompt" data-status={state.status} aria-label="提示词">
    <Group className="pi-prompt-bar" gap={8} wrap="nowrap" px={12} h={34}>
      <Text size="xs" c="dimmed" truncate flex={1} data-field="summary">{summary}</Text>
      <Button data-action="reload-prompt" size="compact-xs" variant="subtle" color="gray" leftSection={<IconRefresh size={12} />} loading={state.status === "loading"} onClick={reload}>刷新</Button>
    </Group>
    <div className="pi-prompt-body">
      {state.status === "error" ? <InlineAlert>{state.message}</InlineAlert>
        : !report ? <div className="pi-file-empty"><Loader size="sm" /></div>
        : !latest ? <Text size="sm" c="dimmed" p="md" data-empty="true">还没有抓到这个会话的请求：它在休眠，或刚启动、还没发过消息。发一条消息后点刷新。</Text>
        : <Stack gap="lg" py="md">
          <PromptSystem latest={latest} diff={report.diff} />
          <PromptTools latest={latest} diff={report.diff} />
          <PromptMessages latest={latest} diff={report.diff} />
          {latest.repeats > 0 ? <Text size="xs" c="dimmed" px={20}>相同的请求又发了 {latest.repeats} 次（重试或缓存预热），不计入比较。</Text> : null}
        </Stack>}
    </div>
  </section>;
}
