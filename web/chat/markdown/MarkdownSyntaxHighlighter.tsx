import "./markdown.css";
import type { SyntaxHighlighterProps } from "@assistant-ui/react-markdown";
import { HighlightedCode } from "../code/HighlightedCode.tsx";
export function MarkdownSyntaxHighlighter({ components: { Pre, Code }, language, code }: SyntaxHighlighterProps) {
  return <Pre><HighlightedCode component={Code} className={language ? `language-${language}` : ""}>{code}</HighlightedCode></Pre>;
}
