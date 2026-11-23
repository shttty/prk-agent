import "./code.css";
import { useMemo } from "react";
import { Fragment } from "react";
import { useHighlightedLines } from "./use-highlighted-lines.js";
import { Segments } from "./Segments.jsx";
/** Markdown keeps its original pre/code structure and literal text, without tool gutters or folding. */
export function HighlightedCode({ children, className = "", component: Code = "code" }) {
  const language = /(?:^|\s)language-([^\s]+)/.exec(className)?.[1];
  const query = useMemo(() => language ? { name: language } : null, [language]);
  const lines = useHighlightedLines(typeof children === "string" ? children : "", query, true);
  return <Code className={className}>{lines ? lines.map((segments, index) => <Fragment key={index}>{index > 0 ? "\n" : ""}<Segments segments={segments} text="" /></Fragment>) : children}</Code>;
}
