import { safeUrl } from "./safe-url.js";
export function SafeLink({ href, children, title }) {
  const url = safeUrl(href);
  if (!url) return <span title={title}>{children}</span>;
  return <a href={url} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
}
