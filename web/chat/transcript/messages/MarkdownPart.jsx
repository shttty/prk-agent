import { useState } from "react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { safeUrl } from "../../markdown/safe-url.js";
import { SafeLink } from "../../markdown/SafeLink.jsx";
import { SafeImage } from "../../markdown/SafeImage.jsx";
import { MarkdownSyntaxHighlighter } from "../../markdown/MarkdownSyntaxHighlighter.jsx";
import { settledBlocksPlugin } from "../../markdown/settled-blocks-plugin.js";
import { markdownPlugins } from "./markdown-plugins.js";
import { CodeHeader } from "./CodeHeader.jsx";
export function MarkdownPart({ text, status }) {
  // One parser cache per text part: while it streams, only its last block is parsed again.
  const [plugins] = useState(() => [...markdownPlugins, settledBlocksPlugin()]);
  return (
    <MarkdownTextPrimitive
      className="pi-markdown markdown"
      smooth={status?.type === "running"}
      urlTransform={safeUrl}
      remarkPlugins={plugins}
      components={{ a: SafeLink, img: SafeImage, CodeHeader, SyntaxHighlighter: MarkdownSyntaxHighlighter }}
    >
      {text}
    </MarkdownTextPrimitive>
  );
}
