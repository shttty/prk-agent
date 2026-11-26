import type { MemoryDocumentData, MemoryEditor as MemoryEditorState } from "./memory-types.ts";
import type { useMemoryListing } from "./use-memory-listing.ts";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { ActionIcon } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Textarea } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { IconTrash } from "@tabler/icons-react";
import { IconPlus } from "@tabler/icons-react";
import "../list-page/list-page.css";

const sameDocument = (left: MemoryEditorState | null, right: MemoryDocumentData) => left?.target === right.target && left?.instance === right.instance && left?.project === right.project;
const scopeOf = (document: MemoryDocumentData) => ({ ...(document.instance ? { instance: document.instance } : {}), ...(document.project ? { project: document.project } : {}) });

/**
 * One memory file: usage line, entries separated by rules with hover actions, and the inline editor.
 * `memory` is `useMemoryListing`; `empty` is the line shown when the file has no entries.
 */
type MemoryDocumentProps = { document: MemoryDocumentData; memory: ReturnType<typeof useMemoryListing>; empty?: string };

export default function MemoryDocument({ document, memory, empty = "还没有条目。" }: MemoryDocumentProps) {
  const { busy, editor, setEditor, setDeletion } = memory;
  const scope = { target: document.target, ...scopeOf(document) };
  const editing = editor && sameDocument(editor, document) ? editor : null;
  const form = () => editing && <MemoryEditor key="editor" editor={editing} busy={busy} setEditor={setEditor} onSave={memory.save} />;
  return <section className="memory-document" data-memory-target={document.target} data-instance={document.instance || ""} data-project={document.project || ""} data-deleted={String(Boolean(document.deleted))}>
    <Text className="memory-usage" data-chars={document.chars} data-limit={document.limit} data-over-limit={String(document.overLimit)}>
      {document.chars.toLocaleString()} / {document.limit.toLocaleString()}{document.soft ? " 推荐" : " 字符"}
    </Text>
    {document.entries.length === 0 && !editing ? <Text className="memory-empty" data-empty="true">{empty}</Text> : null}
    <div className="memory-entries">
      {document.entries.map((entry, index) => editing?.old_text === entry ? form()
        : <article className="memory-entry settings-hover-row" key={index} data-memory-entry={index}>
          <div className="memory-entry-content" data-field="content">{entry}</div>
          <Group className="settings-row-actions" gap={2} wrap="nowrap">
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="编辑" title="编辑" data-action="memory-edit" disabled={busy} onClick={() => setEditor({ ...scope, old_text: entry, content: entry })}><IconPencil size={14} /></ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="删除" title="删除" data-action="memory-remove" disabled={busy} onClick={() => setDeletion({ ...scope, old_text: entry })}><IconTrash size={14} /></ActionIcon>
          </Group>
        </article>)}
      {editing && editing.old_text === undefined ? form() : null}
    </div>
    {editing ? null : <Group justify="space-between" className="memory-document-foot">
      <Button size="compact-sm" variant="subtle" color="gray" leftSection={<IconPlus size={14} />} data-action="memory-add" disabled={busy} onClick={() => setEditor({ ...scope, content: "" })}>新增</Button>
      {document.deleted ? <Button size="compact-sm" variant="subtle" color="red" data-action="memory-delete-instance" disabled={busy} onClick={() => setDeletion({ target: document.target, instance: document.instance })}>删除实例记忆</Button> : null}
    </Group>}
  </section>;
}

type MemoryEditorProps = { editor: MemoryEditorState; busy: boolean; setEditor: (editor: MemoryEditorState | null) => void; onSave: () => void };

function MemoryEditor({ editor, busy, setEditor, onSave }: MemoryEditorProps) {
  return <Stack gap="xs" className="memory-editor">
    <Textarea id="memory-content" aria-label={editor.old_text === undefined ? "新增条目" : "编辑条目"} placeholder={editor.old_text === undefined ? "新条目" : undefined} value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.currentTarget.value })} autosize minRows={2} maxRows={10} autoFocus />
    <Group justify="flex-end" gap="xs">
      <Button id="memory-cancel-edit" variant="default" size="xs" disabled={busy} onClick={() => setEditor(null)}>取消</Button>
      <Button id="memory-save" size="xs" loading={busy} disabled={!editor.content.trim()} onClick={onSave}>保存</Button>
    </Group>
  </Stack>;
}
