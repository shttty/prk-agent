import type { TextMessagePartProps } from "@assistant-ui/react";
import { MarkdownPart } from "./MarkdownPart.tsx";
import { FoldedContent } from "./FoldedContent.tsx";
export function UserMarkdownPart({ text, status }: TextMessagePartProps) {
  return <FoldedContent revision={text}><MarkdownPart status={status} allowImages={false} /></FoldedContent>;
}
