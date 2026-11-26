import { useState } from "react";
import type { TextMessagePartProps } from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { safeUrl } from "../../markdown/safe-url.ts";
import { SafeLink } from "../../markdown/SafeLink.tsx";
import { SafeImage } from "../../markdown/SafeImage.tsx";
import { MarkdownSyntaxHighlighter } from "../../markdown/MarkdownSyntaxHighlighter.tsx";
import { settledBlocksPlugin } from "../../markdown/settled-blocks-plugin.ts";
import { markdownPlugins } from "./markdown-plugins.ts";
import { CodeHeader } from "./CodeHeader.tsx";
// The part's text comes from assistant-ui's part context; only its status and the image switch are props.
export function MarkdownPart({ status, allowImages = true }: Pick<TextMessagePartProps, "status"> & { allowImages?: boolean }) {
  // One parser cache per text part: while it streams, only its last block is parsed again.
  const [plugins] = useState(() => [...markdownPlugins, settledBlocksPlugin()]);
  return (
    <MarkdownTextPrimitive
      className="pi-markdown markdown"
      smooth={status.type === "running"}
      urlTransform={transformUrl}
      remarkPlugins={plugins}
      components={{ a: SafeLink, img: allowImages ? SafeImage : HiddenImage, CodeHeader, SyntaxHighlighter: MarkdownSyntaxHighlighter }}
    />
  );
}

function HiddenImage() { return null; }

function transformUrl(value: string, key: string) { return key === "src" ? value : safeUrl(value); }
