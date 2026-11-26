import { useRef } from "react";
import { useContext } from "react";
import { useState } from "react";
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "@mantine/core";
import { PresentationContext } from "../presentation-context.ts";
/**
 * Height-capped message content with a fade and a toggle. `compact` uses the short peer-message cap;
 * `more` is shown only while expanded and keeps the toggle available even when the content fits.
 * `revision` re-measures when the content changes without resizing the capped box.
 */
type FoldedContentProps = { compact?: boolean; more?: ReactNode; revision: unknown; children: ReactNode };

export function FoldedContent({ compact = false, more = null, revision, children }: FoldedContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const context = useContext(PresentationContext);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return undefined;
    const measure = () => {
      if (!expanded) setOverflowing(node.scrollHeight > node.clientHeight + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, revision]);

  const toggleExpanded = () => {
    context?.preserveDisclosure(contentRef.current);
    setExpanded((current) => !current);
  };
  const collapsed = overflowing && !expanded;
  return (
    <>
      <div ref={contentRef} className={`pi-message-fold${compact ? " is-compact" : ""}${expanded ? " is-expanded" : ""}${collapsed ? " is-collapsed" : ""}`} data-folded={collapsed || undefined}>
        {children}
      </div>
      {expanded ? more : null}
      {overflowing || more ? <Button className="pi-message-fold-toggle" data-action="toggle-message-fold" variant="subtle" size="compact-xs" type="button" onClick={toggleExpanded} aria-expanded={expanded}>
        {expanded ? "收起" : compact ? "展开" : "显示更多"}
      </Button> : null}
    </>
  );
}
