import "../tool-calls/tool-calls.css";
import "./thinking.css";
import { useContext } from "react";
import type { ReasoningMessagePartProps } from "@assistant-ui/react";
import { useAui } from "@assistant-ui/react";
import { IconBrain } from "@tabler/icons-react";
import { IconChevronRight } from "@tabler/icons-react";
import { StaticMarkdown } from "../../markdown/StaticMarkdown.tsx";
import { PresentationContext } from "../presentation-context.ts";
import { presentationKey } from "../presentation/presentation-key.ts";
import { readDisclosure } from "../presentation/read-disclosure.ts";
import { saveDisclosure } from "../presentation/save-disclosure.ts";
import { partIndex } from "../part-index.ts";
import { thinkingPreview } from "./thinking-preview.ts";
/** A model thinking block: one collapsed row in the turn's process fold, shaped like a tool row; opens to the full text. */
export function ThinkingPart({ text, status }: ReasoningMessagePartProps) {
  const context = useContext(PresentationContext);
  const aui = useAui();
  const key = presentationKey(context?.sessionId, `turn:${aui.message.getState().id}:reasoning-${partIndex(aui)}`);
  const open = readDisclosure(context?.openedTools, key, { defaultOpen: context?.expandThinking });
  const setOpen = (next: boolean) => saveDisclosure(context?.actions, key, next);
  const streaming = status?.type === "running";
  const preview = open ? "" : thinkingPreview(text, streaming);
  return (
    <details className="pi-thinking" open={open} data-state={streaming ? "running" : "done"} onToggle={(event) => { if (event.target === event.currentTarget && event.currentTarget.open !== open) setOpen(event.currentTarget.open); }}>
      <summary onClick={(event) => { event.preventDefault(); context?.preserveDisclosure?.(event.currentTarget); setOpen(!open); }}>
        <span className="pi-tool-state" aria-hidden="true"><IconBrain size={14} stroke={1.8} /></span>
        <span className="pi-tool-title"><strong className="tool-name">思考</strong>{preview ? <span className="pi-thinking-preview">{preview}</span> : null}</span>
        <IconChevronRight className="pi-tool-caret" size={14} stroke={1.8} aria-hidden="true" />
      </summary>
      {open ? <StaticMarkdown className="pi-thinking-body" text={text} /> : null}
    </details>
  );
}
