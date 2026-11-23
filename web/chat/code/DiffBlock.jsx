import "./code.css";
import { useMemo } from "react";
import { TOOL_FOLD_LINES } from "../tool-text/tool-text-constants.js";
import { useHighlightedLines } from "./use-highlighted-lines.js";
import { Segments } from "./Segments.jsx";
import { FoldMore } from "./FoldMore.jsx";
import { useFold } from "./use-fold.js";
/** Edit diff (see parseDiff): signed line numbers in the gutter, +/- tinted gently, context dimmed, `…` for skipped ranges. */
export function DiffBlock({ diff, query, className = "", active = true, limit = TOOL_FOLD_LINES, ...rest }) {
  const code = useMemo(() => diff.rows.map((row) => row.text).join("\n"), [diff]);
  const lines = useHighlightedLines(code, query, active);
  const fold = useFold(diff.rows.length, limit);
  return (
    <>
      <pre className={`pi-code-block code-block pi-cl-diff${className ? ` ${className}` : ""}`} style={{ "--pi-ln-w": diff.width }} {...rest}>
        {diff.rows.slice(0, fold.shown).map((row, index) => (
          <span key={index} className={`pi-cl is-${row.kind}`} data-n={row.label}><Segments segments={lines?.[index]} text={row.text} />{index < diff.rows.length - 1 ? "\n" : ""}</span>
        ))}
      </pre>
      {fold.hidden ? <FoldMore lines={fold.hidden} onExpand={fold.expand} /> : null}
    </>
  );
}
