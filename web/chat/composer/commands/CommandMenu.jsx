import "./commands.css";
import { useRef } from "react";
import { useEffect } from "react";
import { IconArrowsDiagonal } from "@tabler/icons-react";
import { safeText } from "../../../workbench/payloads/safe-text.js";
import { commandLabel } from "./command-label.js";
import { commandUsageHint } from "./command-usage-hint.js";
/** "/" completion: command, one-to-two line summary, and a corner button when there is more to read. */
export function CommandMenu({ candidates, activeIndex, onSelect, onHover, onHelp }) {
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);
  return (
    <div id="native-candidate-list" ref={listRef} className="pi-candidates pi-command-menu" role="listbox" aria-label="命令">
      {candidates.map((candidate, index) => {
        const label = commandLabel(candidate);
        const usage = commandUsageHint(candidate);
        const summary = safeText(candidate.summary);
        return (
          <div
            key={`cmd-${candidate.name}-${index}`}
            className={`pi-command-option${index === activeIndex ? " is-active" : ""}${candidate.help ? " has-help" : ""}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(candidate)}
          >
            <div className="pi-command-head"><strong className="pi-command-name">{label}</strong>{usage ? <span className="pi-command-usage">{usage}</span> : null}</div>
            {summary ? <div className="pi-command-summary">{summary}</div> : null}
            {candidate.help ? <button type="button" className="pi-command-more" aria-label={`${label} 的详细说明`} title="详细说明" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); onHelp(candidate); }}><IconArrowsDiagonal size={13} stroke={1.8} /></button> : null}
          </div>
        );
      })}
    </div>
  );
}
