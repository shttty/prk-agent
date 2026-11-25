import "./markdown.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { safeUrl } from "./safe-url.js";
import { SafeLink } from "./SafeLink.jsx";
import { MarkdownCode } from "./MarkdownCode.jsx";
export const plugins = [remarkGfm];

export const components = { a: SafeLink, img: () => null, code: MarkdownCode };

/** Static markdown in the transcript's `.pi-markdown` style (the ask dialog's option previews). */
export function StaticMarkdown({ text, className = "" }) {
  return <div className={`pi-markdown ${className}`}><ReactMarkdown remarkPlugins={plugins} urlTransform={safeUrl} components={components}>{text}</ReactMarkdown></div>;
}
