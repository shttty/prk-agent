import "../tool-calls/tool-calls.css";
import "./thinking.css";
import { useContext } from "react";
import { useState } from "react";
import { IconBrain } from "@tabler/icons-react";
import { IconChevronRight } from "@tabler/icons-react";
import { StaticMarkdown } from "../../markdown/StaticMarkdown.jsx";
import { PresentationContext } from "../presentation-context.js";
import { thinkingPreview } from "./thinking-preview.js";
/** A model thinking block: one collapsed row in the turn's process fold, shaped like a tool row; opens to the full text. */
export function ThinkingPart({ text, status }) {
  const context = useContext(PresentationContext);
  const [open, setOpen] = useState(false);
  const streaming = status?.type === "running";
  const preview = open ? "" : thinkingPreview(text, streaming);
  return (
    <details className="pi-thinking" open={open} data-state={streaming ? "running" : "done"} onToggle={(event) => { if (event.currentTarget.open !== open) setOpen(event.currentTarget.open); }}>
      <summary onClick={(event) => { event.preventDefault(); context?.preserveDisclosure?.(event.currentTarget); setOpen(!open); }}>
        <span className="pi-tool-state" aria-hidden="true"><IconBrain size={14} stroke={1.8} /></span>
        <span className="pi-tool-title"><strong className="tool-name">思考</strong>{preview ? <span className="pi-thinking-preview">{preview}</span> : null}</span>
        <IconChevronRight className="pi-tool-caret" size={14} stroke={1.8} aria-hidden="true" />
      </summary>
      {open ? <StaticMarkdown className="pi-thinking-body" text={text} /> : null}
    </details>
  );
}
