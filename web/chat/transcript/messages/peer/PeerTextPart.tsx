import type { TextMessagePartProps } from "@assistant-ui/react";
import { MarkdownPart } from "../MarkdownPart.tsx";
import { FoldedContent } from "../FoldedContent.tsx";
/** Plain peer-message text: ordinary markdown under the short peer fold. */
export function PeerTextPart({ text, status }: TextMessagePartProps) {
  return <FoldedContent compact revision={text}><MarkdownPart status={status} allowImages={false} /></FoldedContent>;
}
