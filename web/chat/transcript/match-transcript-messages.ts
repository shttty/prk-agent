import { contentText } from "../conversation/content-text.ts";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { printable } from "../../workbench/payloads/printable.js";
import type { TranscriptMessage } from "../conversation/conversation-types.ts";

export function matchTranscriptMessages(messages: readonly TranscriptMessage[], query: string): string[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const includes = (text: unknown) => safeText(text).toLocaleLowerCase().includes(needle);
  return messages.filter(({ content, metadata }) => {
    const custom = metadata?.custom;
    return includes(custom?.copyText) || includes(custom?.compaction?.summary)
      || custom?.attachments?.some(({ name }) => includes(name))
      || custom?.references?.some(({ name, path, text }) => includes(name) || includes(path) || includes(text))
      || content.some((part) => includes(part.type === "tool-call"
        ? `${part.argsText || ""}\n${printable(part.result)}\n${JSON.stringify(part.result?.details || {})}\n${part.artifact?.output || ""}`
        : contentText(part)));
  }).map(({ id }) => id);
}
