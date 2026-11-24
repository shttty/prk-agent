import { contentText } from "../conversation/content-text.js";
import { safeText } from "../../workbench/payloads/safe-text.js";
import { printable } from "../../workbench/payloads/printable.js";

export function matchTranscriptMessages(messages, query) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const includes = (text) => safeText(text).toLocaleLowerCase().includes(needle);
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
