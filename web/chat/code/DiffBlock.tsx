import "./code.css";
import { useMemo } from "react";
import type { ComponentPropsWithoutRef } from "react";
import type { parseDiff } from "../tool-text/parse-diff.ts";
import { TOOL_FOLD_LINES } from "../tool-text/tool-text-constants.ts";
import { useHighlightedLines } from "./use-highlighted-lines.ts";
import { Segments } from "./Segments.tsx";
import { FoldMore } from "./FoldMore.tsx";
import { useFold } from "./use-fold.ts";
import type { CssVarStyle } from "../payload/css-var-style.ts";
import type { HighlightQuery } from "./code-types.ts";

const widthStyle = (width: number): CssVarStyle => ({ "--pi-ln-w": width });

type DiffBlockProps = ComponentPropsWithoutRef<"pre"> & { diff: NonNullable<ReturnType<typeof parseDiff>>; query?: HighlightQuery | null; active?: boolean; limit?: number };
/** Edit diff (see parseDiff): signed line numbers in the gutter, +/- tinted gently, context dimmed, `…` for skipped ranges. */
export function DiffBlock({ diff, query, className = "", active = true, limit = TOOL_FOLD_LINES, ...rest }: DiffBlockProps) {
  const code = useMemo(() => diff.rows.map((row) => row.text).join("\n"), [diff]);
  const lines = useHighlightedLines(code, query, active);
  const fold = useFold(diff.rows.length, limit);
  return (
    <>
      <pre className={`pi-code-block code-block pi-cl-diff${className ? ` ${className}` : ""}`} style={widthStyle(diff.width)} {...rest}>
        {diff.rows.slice(0, fold.shown).map((row, index) => (
          <span key={index} className={`pi-cl is-${row.kind}`} data-n={row.label}><Segments segments={lines?.[index]} text={row.text} />{index < diff.rows.length - 1 ? "\n" : ""}</span>
        ))}
      </pre>
      {fold.hidden ? <FoldMore lines={fold.hidden} onExpand={fold.expand} /> : null}
    </>
  );
}
