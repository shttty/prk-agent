import { Button, Group, Loader, Stack, Text } from "@mantine/core";
import { IconDownload, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import type { DockviewPanelApi } from "dockview-react";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { useVisible } from "../editor-dock/use-visible.ts";
import { useEditorContext } from "../file-editor/use-editor-context.ts";
import { downloadPrompt } from "./download-prompt.ts";
import { PromptMessages } from "./PromptMessages.tsx";
import { PromptSystem } from "./PromptSystem.tsx";
import { PromptTools } from "./PromptTools.tsx";
import { usePromptReport } from "./use-prompt-report.ts";
import "../file-editor/file-editor.css";
import "./prompt-view.css";

/** The debug tool that shows what the session last sent to its model: system sections, tools and messages, each compared with the request before it. Read when first shown and on refresh. */
export function PromptPanel({ api }: { api: DockviewPanelApi }) {
  const { state, reload } = usePromptReport(useVisible(api));
  const { loadPromptPart } = useEditorContext();
  const [downloading, setDownloading] = useState(false);
  const report = state.status === "ok" ? state.report : null;
  const latest = report?.latest ?? null;
  const summary = latest ? `第 ${latest.seq} 次请求 · ${new Date(latest.at).toLocaleTimeString()} · ${latest.model} · ${latest.payloadChars.toLocaleString()} 字符${report?.diff?.modelChanged ? " · 模型与上次不同" : ""}` : "";
  const download = () => {
    if (!latest) return;
    setDownloading(true);
    loadPromptPart<{ payload: unknown }>("raw").then((raw) => downloadPrompt(latest.seq, raw.payload)).catch(() => undefined).finally(() => setDownloading(false));
  };
  return <section className="pi-file pi-prompt" data-panel="prompt" data-status={state.status} aria-label="提示词">
    <Group className="pi-prompt-bar" gap={8} wrap="nowrap" px={12} h={34}>
      <Text size="xs" c="dimmed" truncate flex={1} data-field="summary" data-seq={latest?.seq}>{summary}</Text>
      {latest ? <Button data-action="download-prompt" size="compact-xs" variant="subtle" color="gray" leftSection={<IconDownload size={12} />} loading={downloading} onClick={download}>下载原始请求</Button> : null}
      <Button data-action="reload-prompt" size="compact-xs" variant="subtle" color="gray" leftSection={<IconRefresh size={12} />} loading={state.status === "loading"} onClick={reload}>刷新</Button>
    </Group>
    <div className="pi-prompt-body">
      {state.status === "error" ? <InlineAlert>{state.message}</InlineAlert>
        : !report ? <div className="pi-file-empty"><Loader size="sm" /></div>
        : !latest ? <Text size="sm" c="dimmed" p="md" data-empty="true">还没有抓到这个会话的请求：它在休眠，或刚启动、还没发过消息。发一条消息后会自动出现。</Text>
        : <Stack gap="lg" py="md">
          <PromptSystem latest={latest} diff={report.diff} />
          <PromptTools key={latest.seq} latest={latest} diff={report.diff} />
          <PromptMessages key={latest.seq} latest={latest} diff={report.diff} />
          {latest.repeats > 0 ? <Text size="xs" c="dimmed" px={20}>相同的请求又发了 {latest.repeats} 次（重试或缓存预热），不计入比较。</Text> : null}
        </Stack>}
    </div>
  </section>;
}
