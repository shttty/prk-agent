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
import { AnsiText } from "../ansi/AnsiText.tsx";
import type { HostedNode } from "../../../src/gateway/wire/web-types.ts";
import { optionsFor } from "./options-for.ts";

type NodeAction = { nodeId: string; componentOperation: string; value?: unknown };
type ExtensionNodeProps = { node: HostedNode | null | undefined; onAction?: (args: NodeAction) => void; className?: string };

/** The editable value a node starts from. */
const nodeValue = (node: HostedNode | null | undefined) => node && (node.kind === "input" || node.kind === "editor" || node.kind === "select") ? safeText(node.value) : "";

export function ExtensionNode({ node, onAction, className = "" }: ExtensionNodeProps) {
  const [draft, setDraft] = useState(nodeValue(node));
  const value = nodeValue(node);
  // While the user edits, the echoed component value lags behind keystrokes; adopting it would drop typed text.
  const editingRef = useRef(false);
  const resetDraftForNode = useEffectEvent(() => {
    editingRef.current = false;
    setDraft(value);
  });
  useEffect(() => { resetDraftForNode(); }, [node?.id]);
  useEffect(() => { if (!editingRef.current) setDraft(value); }, [value]);
  if (!node) return null;
  const nodeId = safeText(node.id);
  const act = (componentOperation: string, payload?: unknown) => onAction?.({ nodeId, componentOperation, ...(payload === undefined ? {} : { value: payload }) });
  if (node.kind === "text") return <pre className={`extension-ui-text ${className}`} data-blocked={node.blocked ? "true" : undefined}><AnsiText text={node.lines.join("\n")} /></pre>;
  if (node.kind === "container") return <div className={`extension-ui-container is-${node.direction === "row" ? "row" : "column"} ${className}`}>{node.children.map((child, index) => <ExtensionNode key={child.id || index} node={child} onAction={onAction} />)}</div>;
  const controls = <Group justify="flex-end" gap="xs" mt={6}>{node.cancel ? <Button size="compact-xs" variant="default" data-action="cancel" onClick={() => act("cancel")}>取消</Button> : null}{node.submit ? <Button size="compact-xs" data-action="submit" onClick={() => act("submit", draft)}>提交</Button> : null}</Group>;
  if (node.kind === "select") return <div className={`extension-ui-component ${className}`} data-node-id={nodeId}><Select value={draft || null} allowDeselect={false} onChange={(next) => { if (next !== null) { setDraft(next); act("change", next); } }} data={optionsFor(node.options)} />{controls}</div>;
  if (node.kind === "settings") {
    if (node.submenu) return <Stack className={`extension-ui-component ${className}`} data-node-id={nodeId} gap="xs"><ExtensionNode node={node.submenu} onAction={onAction} /><Group justify="flex-end"><Button size="compact-xs" variant="default" data-action="cancel" onClick={() => act("cancel")}>取消</Button></Group></Stack>;
    return <Stack className={`extension-ui-component ${className}`} data-node-id={nodeId} gap="xs">{node.items.map((item) => <Group key={item.id} justify="space-between" wrap="nowrap"><Text size="sm"><AnsiText text={item.label || item.id} /></Text>{item.submenu ? <Button size="compact-xs" variant="default" data-settings-submenu={item.id} onClick={() => act("submit", item.id)}><AnsiText text={item.value || item.label || item.id} /></Button> : item.options ? <Select value={safeText(item.value) || null} allowDeselect={false} onChange={(next) => { if (next !== null) act("change", { id: item.id, value: next }); }} data={optionsFor(item.options)} /> : <Text size="sm"><AnsiText text={item.value} /></Text>}</Group>)}{controls}</Stack>;
  }
  const Input = node.kind === "editor" ? Textarea : TextInput;
  return <div className={`extension-ui-component ${className}`} data-node-id={nodeId}><Input value={draft} onFocus={() => { editingRef.current = true; }} onBlur={() => { editingRef.current = false; }} onChange={(event) => { const next = event.currentTarget.value; setDraft(next); act("change", next); }} {...(node.kind === "editor" ? { autosize: true, minRows: 3 } : {})} />{controls}</div>;
}
