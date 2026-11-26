import { HighlightedCode } from "../code/HighlightedCode.tsx";
import type { ReactNode } from "react";

export function MarkdownCode({ className, children }: { className?: string; children?: ReactNode }) {
  return <HighlightedCode className={className}>{children}</HighlightedCode>;
}
