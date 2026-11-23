import "./code.css";
import { useMemo } from "react";
import { TOOL_FOLD_LINES } from "../tool-text/tool-text-constants.js";
import { splitRows } from "../tool-text/split-rows.js";
import { ansiLines } from "../ansi/ansi-lines.js";
import { stripAnsi } from "../ansi/strip-ansi.js";
import { useHighlightedLines } from "./use-highlighted-lines.js";
import { Segments } from "./Segments.jsx";
import { FoldMore } from "./FoldMore.jsx";
import { useFold } from "./use-fold.js";
/**
 * mode "numbers": dark line-number gutter starting at `start`; "prompt": `$` before the first line; "plain": text only.
 * `query` is `{ name }` (language name) or `{ filename }`. Blocks longer than `limit` lines show the first `limit`
 * and a FoldMore; `active` false (collapsed tool row) defers syntax highlighting. `output` marks result text
 * (`.output-block`) as opposed to input (`.code-block`).
 */
export function CodeBlock({ code, query, mode = "plain", start = 1, output = false, className = "", active = true, limit = TOOL_FOLD_LINES, deferred, loadContent, ...rest }) {
  const ansi = useMemo(() => output && /[\u001B\u009B]/.test(code) ? ansiLines(code) : null, [code, output]);
  const source = ansi ? stripAnsi(code) : code;
  const lines = useHighlightedLines(source, ansi ? null : query, active);
  const { rows, trailing } = useMemo(() => splitRows(source), [source]);
  const fold = useFold(rows.length, limit);
  const width = String(start + rows.length - 1).length;
  return (
    <>
      <pre
        className={`${output ? "pi-output-block output-block" : "pi-code-block code-block"} pi-cl-${mode}${className ? ` ${className}` : ""}`}
        style={mode === "numbers" ? { counterReset: `pi-ln ${start - 1}`, "--pi-ln-w": width } : undefined}
        data-total-bytes={deferred?.bytes}
        data-total-lines={deferred?.lines}
        {...rest}
      >
        {rows.slice(0, fold.shown).map((row, index) => (
          <span key={index} className="pi-cl">{ansi ? ansi[index] : <Segments segments={lines?.[index]} text={row} />}{index < rows.length - 1 || trailing ? "\n" : ""}</span>
        ))}
      </pre>
      {deferred ? <FoldMore key={deferred.version} lines={Math.max(0, deferred.lines - rows.length)} totalLines={deferred.lines} bytes={deferred.bytes} rest={loadContent} />
        : fold.hidden ? <FoldMore lines={fold.hidden} onExpand={fold.expand} /> : null}
    </>
  );
}
