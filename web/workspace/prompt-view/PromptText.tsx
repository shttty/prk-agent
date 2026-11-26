import { Button, Stack } from "@mantine/core";
import { useState } from "react";
import { copyText } from "../file-actions/copy-text.ts";

/** Text shown as it is (monospace, wrapped, selectable) with a copy button. */
export function PromptText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { void copyText(text).then((ok) => { setCopied(ok); if (ok) window.setTimeout(() => setCopied(false), 1500); }); };
  return <Stack gap={2} align="flex-end" px={8}>
    <Button data-action="copy-prompt-text" size="compact-xs" variant="subtle" color="gray" onClick={copy}>{copied ? "已复制" : "复制"}</Button>
    <pre className="pi-prompt-text">{text}</pre>
  </Stack>;
}
