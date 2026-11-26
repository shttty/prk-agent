import { NativeSelect } from "@mantine/core";
import { StaticMarkdown } from "../../chat/markdown/StaticMarkdown.jsx";
import { Group } from "@mantine/core";
import { rowActions } from "./library-actions.js";
import { Button } from "@mantine/core";
import { operationLabels } from "./library-actions.js";
import { statusLabels } from "./library-actions.js";
import "./library-details.css";
export function LibraryDetails({ entry, kind, busy, onAction, scope }) {
  const skill = kind === "skills";
  return <>
    <header className="library-entry-header">
      <p data-status={entry.status} data-manual={String(entry.manual)} data-version={entry.version}>{statusLabels[entry.status] ?? entry.status}{entry.manual ? " · 手动" : ""}{entry.version ? ` · v${entry.version}` : ""}</p>
      <div className="library-entry-facts">
        <span data-field="distinct-sessions" data-count={entry.distinctSessions}>使用会话 {entry.distinctSessions}</span>
        {!skill ? <span data-field="successful-calls" data-count={entry.successfulCalls}>成功调用 {entry.successfulCalls}</span> : null}
        <span data-last-used={entry.lastUsedAt || ""}>{entry.lastUsedAt ? `最近使用 ${new Date(entry.lastUsedAt).toLocaleString()}` : "暂无使用记录"}</span>
      </div>
    </header>
    {skill && entry.scope ? <label className="library-scope" data-field="scope">范围<NativeSelect size="xs" aria-label="范围" value={entry.scope} data={scope.options(entry.scope)} disabled={busy} onChange={(event) => scope.onChange(entry, event.currentTarget.value)} /></label> : null}
    {skill ? <>
      <dl id="skill-evidence-detail" data-name={entry.name}><dt>适用情况</dt><dd id="skill-when-to-use">{entry.whenToUse}</dd><dt>依据</dt><dd id="skill-evidence">{entry.evidence}</dd></dl>
      <StaticMarkdown text={entry.body} className="library-skill-content" />
      {entry.files?.length ? <ul id="skill-files">{entry.files.map((file) => <li key={file}>{file}</li>)}</ul> : null}
    </> : <>
      <dl id="tool-metadata"><dt>复用理由</dt><dd id="tool-reason">{entry.reason}</dd><dt>签名</dt><dd data-field="signature"><code>{entry.signature}</code></dd><dt>说明</dt><dd data-field="docstring">{entry.docstring || ""}</dd></dl>
      <pre id="tool-source"><code>{entry.source}</code></pre>
    </>}
    <Group id={`${kind}-actions`} gap="xs">
      {rowActions(entry).map((action) => <Button key={action} id={`${kind}-${action}`} data-action={action} data-name={entry.name} size="xs" disabled={busy} color={action === "delete" ? "red" : undefined} variant="default" onClick={() => onAction(action, entry)}>{operationLabels[action]}</Button>)}
    </Group>
  </>;
}
