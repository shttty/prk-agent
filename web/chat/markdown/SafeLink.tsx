import type { ComponentProps } from "react";
import { safeUrl } from "./safe-url.ts";
export function SafeLink({ href, children, title }: ComponentProps<"a">) {
  const url = safeUrl(href);
  if (!url) return <span title={title}>{children}</span>;
  return <a href={url} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
}
