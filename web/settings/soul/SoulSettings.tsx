import type { PageApi } from "../../shell/page/page-types.ts";
import { useMemo } from "react";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Text } from "@mantine/core";
import { Loader } from "@mantine/core";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@uiw/react-codemirror";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { highlightExtensions } from "../../workspace/file-editor/FileBody.tsx";
import { useLanguage } from "../../workspace/file-editor/use-language.ts";
import { useSoulFile } from "./use-soul-file.ts";
import { LinkWait } from "../list-page/LinkWait.tsx";
import "../../workspace/file-editor/file-editor.css";
import "./soul.css";

/** Settings page 人格: the operator-written `session.soulFile`, edited as Markdown. */
export default function SoulSettings({ api }: { api: PageApi }) {
  const soul = useSoulFile(api);
  const { view, draft, setDraft, dirty, busy, error, conflict } = soul;
  const scheme = useComputedColorScheme("light");
  const language = useLanguage("soul.md");
  const extensions = useMemo(() => [EditorView.lineWrapping, ...(language ? [language] : []), ...highlightExtensions], [language]);
  if (!view) return <div className="soul-settings" id="soul-settings" aria-busy={busy}>{soul.waiting ? <LinkWait /> : error ? <InlineAlert id="soul-error" size="sm">{error}</InlineAlert> : <Loader size="sm" color="gray" />}</div>;
  if (!view.configured) return <div className="soul-settings" id="soul-settings" data-configured="false"><Text className="soul-note">未配置 session.soulFile</Text></div>;
  const over = new TextEncoder().encode(draft).length > view.maxBytes;
  return <div className="soul-settings" id="soul-settings" data-configured="true" data-dirty={String(dirty)} data-conflict={String(conflict)} aria-busy={busy}>
    <Text className="soul-note">保存后对新建、唤醒或重载的会话生效</Text>
    <Text className="soul-path" id="soul-path" title={view.path}>{view.path}</Text>
    {conflict ? <InlineAlert id="soul-conflict" size="sm" color="yellow">
      <Group justify="space-between" gap="xs"><span>文件已被外部修改，请重新载入</span><Button data-action="soul-reload" size="compact-xs" variant="default" onClick={() => void soul.load()}>重新载入</Button></Group>
    </InlineAlert> : null}
    {error ? <InlineAlert id="soul-error" size="sm">{error}</InlineAlert> : null}
    <CodeMirror className="pi-file-editor soul-editor" id="soul-editor" value={draft} theme={scheme} extensions={extensions} onChange={setDraft} minHeight="240px" maxHeight="min(56dvh, 560px)"
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, syntaxHighlighting: false }} aria-label="人格文件" />
    <Group className="soul-actions" justify="space-between" wrap="nowrap">
      <Text className="soul-count" data-over-limit={String(over)}>{[...draft].length.toLocaleString()} 字符{dirty ? " · 有未保存修改" : ""}</Text>
      <Group gap="xs" wrap="nowrap">
        <Button id="soul-revert" variant="default" size="xs" disabled={!dirty || busy} onClick={soul.revert}>还原</Button>
        <Button id="soul-save" size="xs" loading={busy} disabled={!dirty || over || conflict} onClick={() => void soul.save()}>保存</Button>
      </Group>
    </Group>
  </div>;
}
