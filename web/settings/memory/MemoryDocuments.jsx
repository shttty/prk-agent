import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Textarea } from "@mantine/core";

export const sameDocument = (left, right) => left?.target === right.target && left?.instance === right.instance && left?.project === right.project;
const scopeOf = (document) => ({ ...(document.instance ? { instance: document.instance } : {}), ...(document.project ? { project: document.project } : {}) });
const keyOf = (document) => `${document.target}:${document.instance ?? ""}:${document.project ?? ""}`;

/** Every document of one layer: one for unscoped layers, one per instance or project otherwise. */
export default function MemoryDocuments({ layer, label, documents, busy, editor, setEditor, setDeletion, onSave }) {
  return <div className="memory-documents" data-layer={layer.name} data-scope={layer.scope}>
    {documents.map((document) => <section className="memory-document" key={keyOf(document)} data-memory-target={document.target} data-instance={document.instance || ""} data-project={document.project || ""} data-deleted={String(Boolean(document.deleted))}>
      <header className="memory-document-head">
        <div><h3>{document.projectName || document.instance || label}</h3>{document.deleted ? <Text size="xs" c="dimmed">已删除实例</Text> : null}</div>
        <span className="memory-usage" data-chars={document.chars} data-limit={document.limit} data-over-limit={String(document.overLimit)}>{document.chars.toLocaleString()} / {document.limit.toLocaleString()}{document.soft ? " 推荐" : " 字符"}</span>
      </header>
      <div className="memory-entries">
        {document.entries.map((entry, index) => <article className="memory-entry" key={index} data-memory-entry={index}>
          <div className="memory-entry-content" data-field="content">{entry}</div>
          <Group gap={4} justify="flex-end">
            <Button size="compact-xs" variant="subtle" data-action="memory-edit" disabled={busy} onClick={() => setEditor({ target: document.target, ...scopeOf(document), old_text: entry, content: entry })}>编辑</Button>
            <Button size="compact-xs" variant="subtle" color="red" data-action="memory-remove" disabled={busy} onClick={() => setDeletion({ target: document.target, ...scopeOf(document), old_text: entry })}>删除</Button>
          </Group>
        </article>)}
      </div>
      {editor && sameDocument(editor, document) ? <Stack gap="xs" className="memory-editor">
        <Textarea id="memory-content" label={editor.old_text === undefined ? "新增条目" : "编辑条目"} value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.currentTarget.value })} autosize minRows={3} maxRows={10} />
        <Group justify="flex-end" gap="xs"><Button id="memory-cancel-edit" variant="default" size="xs" disabled={busy} onClick={() => setEditor(null)}>取消</Button><Button id="memory-save" size="xs" loading={busy} disabled={!editor.content.trim()} onClick={onSave}>保存</Button></Group>
      </Stack> : <Group justify="space-between" mt="xs"><Button size="compact-sm" variant="default" data-action="memory-add" disabled={busy} onClick={() => setEditor({ target: document.target, ...scopeOf(document), content: "" })}>新增</Button>{document.deleted ? <Button size="compact-sm" variant="subtle" color="red" data-action="memory-delete-instance" disabled={busy} onClick={() => setDeletion({ target: document.target, instance: document.instance })}>删除实例记忆</Button> : null}</Group>}
    </section>)}
    {documents.length === 0 ? <Text size="sm" c="dimmed" data-empty="true">{layer.scope === "project" ? "暂无项目。" : "暂无实例。"}</Text> : null}
  </div>;
}
