import { MarkdownPart } from "./MarkdownPart.jsx";
import { FoldedContent } from "./FoldedContent.jsx";
export function UserMarkdownPart({ text, status }) {
  return <FoldedContent revision={text}><MarkdownPart text={text} status={status} allowImages={false} /></FoldedContent>;
}
