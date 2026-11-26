import { useState } from "react";
import { Text } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { Textarea } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { AnsiText } from "../ansi/AnsiText.tsx";
import { stripAnsi } from "../ansi/strip-ansi.ts";
import { Countdown } from "./Countdown.tsx";
import { optionsFor } from "./options-for.ts";
import type { ExtensionAction, ExtensionPrompt } from "../../workbench/store/extension-ui/extension-render-types.ts";
import { ExtensionNode } from "./ExtensionNode.tsx";
/** A plugin dialog (select / confirm / input / editor) or a non-overlay `ctx.ui.custom`: a card in the tray above the composer. */
export function Prompt({ prompt, actions }: { prompt: ExtensionPrompt; actions: ExtensionAction }) {
  const id = safeText(prompt.id);
  const kind = safeText(prompt.kind);
  const [value, setValue] = useState(safeText(prompt.prefill));
  const cancel = () => void actions({ operation: kind === "custom" ? "custom-cancel" : "dialog", id: prompt.parentId || id, cancel: true });
  const submit = () => void actions({ operation: "dialog", id, value: kind === "confirm" ? true : value });
  if (!id || prompt.hidden || prompt.visible === false) return null;
  return <div className={`extension-ui-prompt extension-ui-prompt-${kind}`} data-prompt-id={id} data-prompt-kind={kind}>
    {prompt.title || prompt.expiresAt ? <div className="extension-ui-prompt-head">
      {prompt.title ? <Text className="extension-ui-prompt-title" fw={600}><AnsiText text={prompt.title} /></Text> : <span />}
      <Countdown expiresAt={prompt.expiresAt} onExpire={cancel} />
    </div> : null}
    {prompt.message ? <Text className="extension-ui-prompt-message" size="sm"><AnsiText text={prompt.message} /></Text> : null}
    {kind === "select" ? <div className="extension-ui-options" role="listbox" aria-label={stripAnsi(prompt.title || prompt.message || "")}>
      {optionsFor(prompt.options).map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} data-value={option.value} onClick={() => { setValue(option.value); void actions({ operation: "dialog", id, value: option.value }); }}>{option.label}</button>)}
    </div> : null}
    {kind === "input" ? <TextInput value={value} onChange={(event) => setValue(event.currentTarget.value)} placeholder={prompt.placeholder} /> : null}
    {kind === "editor" ? <Textarea value={value} onChange={(event) => setValue(event.currentTarget.value)} placeholder={prompt.placeholder} autosize minRows={4} maxRows={10} /> : null}
    {prompt.node ? <ExtensionNode node={prompt.node} onAction={(args) => void actions({ operation: "component", ...args })} /> : null}
    <Group className="extension-ui-prompt-actions" justify="flex-end" gap="xs"><Button size="compact-sm" variant="default" data-action="cancel" onClick={cancel}>取消</Button>{["confirm", "input", "editor"].includes(kind) ? <Button size="compact-sm" data-action="submit" onClick={submit}>{kind === "confirm" ? "确认" : "提交"}</Button> : null}</Group>
  </div>;
}
