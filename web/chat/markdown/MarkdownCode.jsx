import { HighlightedCode } from "../code/HighlightedCode.jsx";
export function MarkdownCode({ className, children }) {
  return <HighlightedCode className={className}>{children}</HighlightedCode>;
}
