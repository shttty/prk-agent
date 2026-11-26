import { MarkdownPart } from "../MarkdownPart.jsx";
import { FoldedContent } from "../FoldedContent.jsx";
/** Plain peer-message text: ordinary markdown under the short peer fold. */
export function PeerTextPart({ text, status }) {
  return <FoldedContent compact revision={text}><MarkdownPart text={text} status={status} allowImages={false} /></FoldedContent>;
}
