import remarkGfm from "remark-gfm";
import { codeHighlighters } from "../../chat/code/code-highlighters.js";
import { syntaxHighlighting } from "@codemirror/language";
import { useLanguage } from "./use-language.js";
import { useMemo } from "react";
import { Loader } from "@mantine/core";
import { Text } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { SegmentedControl } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.jsx";
import ReactMarkdown from "react-markdown";
import CodeMirror from "@uiw/react-codemirror";
import { STALE_NOTICE } from "../file-store/stale-notice.js";
export const markdownPlugins = [remarkGfm];

export const highlightExtensions = codeHighlighters.map((highlighter) => syntaxHighlighting(highlighter));

export function FileBody({ store, file, scheme }) {
  const language = useLanguage(file.name);
  const extensions = useMemo(() => (language ? [language, ...highlightExtensions] : highlightExtensions), [language]);
  if (file.loading) return <div className="pi-file-empty"><Loader size="sm" /></div>;
  const retargeted = file.retargeted === true;
  // A document read from the previous execution target stays on screen even when reading it again fails: its text may be the only copy.
  if (file.error && !retargeted) return <div className="pi-file-empty"><InlineAlert>{file.error}</InlineAlert></div>;
  const notices = retargeted ? <>
    <InlineAlert id="file-retargeted" color="yellow" role="alert" m="xs" flex="none">
      <Text size="xs">{STALE_NOTICE}</Text>
      {file.content !== file.original ? <Text size="xs">重新载入会用当前环境的文件替换编辑区内容，未保存的修改将丢弃。</Text> : null}
      <Group gap={6} mt={6}><Button data-action="reload-file" size="compact-xs" variant="default" onClick={() => void store.load(file.path)}>重新载入</Button></Group>
    </InlineAlert>
    {file.error ? <InlineAlert id="file-reload-error" m="xs" flex="none">{file.error}</InlineAlert> : null}
  </> : null;
  const shown = (content) => (retargeted ? <div className="pi-file-body">{notices}{content}</div> : content);
  if (file.kind === "image") return shown(<div className="pi-file-image"><img src={`data:${file.mimetype || "image/png"};base64,${file.content.replace(/\s/g, "")}`} alt={file.name} /></div>);
  if (file.kind === "binary") return shown(<div className="pi-file-empty">二进制文件，不支持预览。</div>);
  const preview = file.kind === "markdown" && file.view === "preview";
  return <div className="pi-file-body" onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void store.save(file.path); }
  }}>
    {notices}
    {file.conflict ? <InlineAlert id="file-conflict" color="yellow" role="alert" m="xs" flex="none">
      <Text size="xs">文件已被其他进程修改（可能是 agent）。</Text>
      <Group gap={6} mt={6}><Button data-action="reload-file" size="compact-xs" variant="default" onClick={() => void store.load(file.path)}>重新载入</Button><Button data-action="overwrite-file" size="compact-xs" color="red" variant="light" onClick={() => void store.save(file.path, true)}>仍然覆盖</Button></Group>
    </InlineAlert> : null}
    {file.kind === "markdown" ? <div className="pi-file-toolbar">
      <SegmentedControl size="xs" value={file.view} onChange={(view) => store.setView(file.path, view)} data={[{ value: "preview", label: "预览" }, { value: "source", label: "源码" }]} />
    </div> : null}
    {preview
      ? <div className="pi-file-markdown pi-markdown"><ReactMarkdown remarkPlugins={markdownPlugins}>{file.content}</ReactMarkdown></div>
      : <CodeMirror className="pi-file-editor" value={file.content} theme={scheme} extensions={extensions} editable={file.writable !== false} onChange={(value) => store.edit(file.path, value)}
        basicSetup={{ foldGutter: true, highlightActiveLine: true, syntaxHighlighting: false }} aria-label={`编辑 ${file.path}`} />}
  </div>;
}
