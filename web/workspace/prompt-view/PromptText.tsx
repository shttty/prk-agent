import { Button, Stack } from "@mantine/core";
import { useState } from "react";
import { copyText } from "../file-actions/copy-text.ts";

type PromptTextProps = { text: string; copy?: string };

/** Text shown as it is (monospace, wrapped, selectable) with a copy button; `copy` is what the button copies when that is not the shown text. */
export function PromptText({ text, copy = text }: PromptTextProps) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => { void copyText(copy).then((ok) => { setCopied(ok); if (ok) window.setTimeout(() => setCopied(false), 1500); }); };
  return <Stack gap={2} align="flex-end" px={8}>
    <Button data-action="copy-prompt-text" size="compact-xs" variant="subtle" color="gray" onClick={onCopy}>{copied ? "已复制" : "复制"}</Button>
    <pre className="pi-prompt-text">{text}</pre>
  </Stack>;
}
