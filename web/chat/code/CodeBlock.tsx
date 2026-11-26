import "./code.css";
import { useMemo } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { TOOL_FOLD_LINES } from "../tool-text/tool-text-constants.ts";
import { splitRows } from "../tool-text/split-rows.ts";
import { ansiLines } from "../ansi/ansi-lines.ts";
import { stripAnsi } from "../ansi/strip-ansi.ts";
import { useHighlightedLines } from "./use-highlighted-lines.ts";
import { Segments } from "./Segments.tsx";
import { FoldMore } from "./FoldMore.tsx";
import { useFold } from "./use-fold.ts";
import type { CssVarStyle } from "../payload/css-var-style.ts";
import type { DeferredContent, HighlightQuery } from "./code-types.ts";

const numberStyle = (start: number, width: number): CssVarStyle => ({ counterReset: `pi-ln ${start - 1}`, "--pi-ln-w": width });

type CodeBlockProps = Omit<ComponentPropsWithoutRef<"pre">, "children"> & {
  code: string; query?: HighlightQuery | null; mode?: "numbers" | "prompt" | "plain"; start?: number; output?: boolean;
  active?: boolean; limit?: number; deferred?: DeferredContent; loadContent?: () => Promise<unknown>;
};
/**
 * mode "numbers": dark line-number gutter starting at `start`; "prompt": `$` before the first line; "plain": text only.
 * `query` is `{ name }` (language name) or `{ filename }`. Blocks longer than `limit` lines show the first `limit`
 * and a FoldMore; `active` false (collapsed tool row) defers syntax highlighting. `output` marks result text
 * (`.output-block`) as opposed to input (`.code-block`).
 */
export function CodeBlock({ code, query, mode = "plain", start = 1, output = false, className = "", active = true, limit = TOOL_FOLD_LINES, deferred, loadContent, ...rest }: CodeBlockProps) {
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
        style={mode === "numbers" ? numberStyle(start, width) : undefined}
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
