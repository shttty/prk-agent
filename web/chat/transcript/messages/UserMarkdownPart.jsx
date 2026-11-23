import { useRef } from "react";
import { useContext } from "react";
import { useState } from "react";
import { useLayoutEffect } from "react";
import { Button } from "@mantine/core";
import { PresentationContext } from "../presentation-context.js";
import { MarkdownPart } from "./MarkdownPart.jsx";
export function UserMarkdownPart({ text, status }) {
  const contentRef = useRef(null);
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
  }, [expanded, text]);

  const toggleExpanded = () => {
    context?.preserveDisclosure(contentRef.current);
    setExpanded((current) => !current);
  };

  return (
    <>
      <div ref={contentRef} className={`pi-user-message-content${expanded ? " is-expanded" : ""}${overflowing && !expanded ? " is-collapsed" : ""}`}>
        <MarkdownPart text={text} status={status} />
      </div>
      {overflowing ? <Button className="pi-user-expand" variant="subtle" size="compact-xs" type="button" onClick={toggleExpanded} aria-expanded={expanded}>{expanded ? "收起" : "显示更多"}</Button> : null}
    </>
  );
}
