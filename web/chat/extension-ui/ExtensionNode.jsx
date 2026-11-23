import { useState } from "react";
import { useRef } from "react";
import { useEffectEvent } from "react";
import { useEffect } from "react";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { Select } from "@mantine/core";
import { Stack } from "@mantine/core";
import { Text } from "@mantine/core";
import { Textarea } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { AnsiText } from "../ansi/AnsiText.jsx";
import { optionsFor } from "./options-for.js";
export function ExtensionNode({ node, onAction, className = "" }) {
  const [draft, setDraft] = useState(safeText(node?.value));
  // While the user edits, the echoed component value lags behind keystrokes; adopting it would drop typed text.
  const editingRef = useRef(false);
  const resetDraftForNode = useEffectEvent(() => {
    editingRef.current = false;
    setDraft(safeText(node?.value));
  });
  useEffect(() => { resetDraftForNode(); }, [node?.id]);
  useEffect(() => { if (!editingRef.current) setDraft(safeText(node?.value)); }, [node?.value]);
  if (!node) return null;
  const nodeId = safeText(node.id);
  const act = (componentOperation, value) => onAction?.({ nodeId, componentOperation, ...(value === undefined ? {} : { value }) });
  if (node.kind === "text" || node.blocked) return <pre className={`extension-ui-text ${className}`} data-blocked={node.blocked ? "true" : undefined}><AnsiText text={(Array.isArray(node.lines) ? node.lines : []).join("\n")} /></pre>;
  if (node.kind === "container") return <div className={`extension-ui-container is-${node.direction === "row" ? "row" : "column"} ${className}`}>{(Array.isArray(node.children) ? node.children : []).map((child, index) => <ExtensionNode key={child?.id || index} node={child} onAction={onAction} />)}</div>;
  const controls = <Group justify="flex-end" gap="xs" mt={6}>{node.cancel ? <Button size="compact-xs" variant="default" data-action="cancel" onClick={() => act("cancel")}>取消</Button> : null}{node.submit ? <Button size="compact-xs" data-action="submit" onClick={() => act("submit", draft)}>提交</Button> : null}</Group>;
  if (node.kind === "select") return <div className={`extension-ui-component ${className}`} data-node-id={nodeId}><Select value={draft || null} allowDeselect={false} onChange={(next) => { if (next !== null) { setDraft(next); act("change", next); } }} data={optionsFor(node.options)} />{controls}</div>;
  if (node.kind === "settings") {
    if (node.submenu) return <Stack className={`extension-ui-component ${className}`} data-node-id={nodeId} gap="xs"><ExtensionNode node={node.submenu} onAction={onAction} /><Group justify="flex-end"><Button size="compact-xs" variant="default" data-action="cancel" onClick={() => act("cancel")}>取消</Button></Group></Stack>;
    return <Stack className={`extension-ui-component ${className}`} data-node-id={nodeId} gap="xs">{(Array.isArray(node.items) ? node.items : []).map((item) => <Group key={item.id} justify="space-between" wrap="nowrap"><Text size="sm"><AnsiText text={item.label || item.id} /></Text>{item.submenu ? <Button size="compact-xs" variant="default" data-settings-submenu={item.id} onClick={() => act("submit", item.id)}><AnsiText text={item.value || item.label || item.id} /></Button> : Array.isArray(item.options) ? <Select value={safeText(item.value) || null} allowDeselect={false} onChange={(next) => { if (next !== null) act("change", { id: item.id, value: next }); }} data={optionsFor(item.options)} /> : <Text size="sm"><AnsiText text={item.value} /></Text>}</Group>)}{controls}</Stack>;
  }
  if (node.kind === "input" || node.kind === "editor") {
    const Input = node.kind === "editor" ? Textarea : TextInput;
    return <div className={`extension-ui-component ${className}`} data-node-id={nodeId}><Input value={draft} onFocus={() => { editingRef.current = true; }} onBlur={() => { editingRef.current = false; }} onChange={(event) => { const next = event.currentTarget.value; setDraft(next); act("change", next); }} {...(node.kind === "editor" ? { autosize: true, minRows: 3 } : {})} />{controls}</div>;
  }
  return null;
}
