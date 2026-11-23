import "./markdown.css";
import { HighlightedCode } from "../code/HighlightedCode.jsx";
export function MarkdownSyntaxHighlighter({ components: { Pre, Code }, language, code }) {
  return <Pre><HighlightedCode component={Code} className={language ? `language-${language}` : ""}>{code}</HighlightedCode></Pre>;
}
