import { useState } from "react";
import { Text } from "@mantine/core";
import { UnstyledButton } from "@mantine/core";
import { Collapse } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import MemoryDocument from "./MemoryDocument.jsx";

/**
 * Every document of one layer. Unscoped layers have one; instance layers fold one section per instance, with
 * `currentInstance` (the selected session's) open first.
 */
export default function MemoryDocuments({ layer, documents, memory, currentInstance }) {
  return <div className="memory-documents" data-layer={layer.name} data-scope={layer.scope}>
    {layer.scope === "none"
      ? documents.map((document) => <MemoryDocument key={document.target} document={document} memory={memory} />)
      : documents.map((document) => <InstanceSection key={document.instance} document={document} memory={memory} initiallyOpen={document.instance === currentInstance || documents.length === 1} />)}
    {layer.scope !== "none" && documents.length === 0 ? <Text size="sm" c="dimmed" data-empty="true">暂无实例。</Text> : null}
  </div>;
}

function InstanceSection({ document, memory, initiallyOpen }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <div className="memory-instance" data-instance-section={document.instance} data-open={String(open)}>
    <UnstyledButton className="memory-instance-head" data-action="toggle-memory-instance" aria-expanded={open} onClick={() => setOpen(!open)}>
      <IconChevronRight className="memory-instance-caret" size={14} stroke={2} aria-hidden="true" />
      <span className="memory-instance-name">{document.instance}</span>
      <span className="memory-instance-meta">{document.deleted ? "已删除实例 · " : ""}{document.entries.length} 条</span>
    </UnstyledButton>
    <Collapse expanded={open}><div className="memory-instance-body"><MemoryDocument document={document} memory={memory} /></div></Collapse>
  </div>;
}
