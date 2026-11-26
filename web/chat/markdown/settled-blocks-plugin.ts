import { fromMarkdown } from "mdast-util-from-markdown";
import type { Nodes, Root, RootContent } from "mdast";
import type { Processor } from "unified";
import type { Point } from "unist";
// Link reference and footnote definitions apply to the whole document; with one present every parse is a full one.
const DEFINITION = /^ {0,3}\[(?:[^\]\\\n]|\\.)+\]:/m;
type Settled = { text: string; children: RootContent[]; start: Point };
const EMPTY: Settled = { text: "", children: [], start: { line: 1, column: 1, offset: 0 } };

/**
 * A remark parser for one growing text (a streamed message part, revealed a few characters per frame). In CommonMark
 * every top-level block before the last one is closed and text appended later can only change the last block, with
 * one exception: the last block can grow into a list item (`2` → `2.`) that joins a list right before it. So the
 * blocks before the last one (and before a list preceding it) are kept, and only the text from the line where the
 * first unsettled block starts is parsed again, positions shifted into the document. The tree equals a full parse of
 * the same text. Each call returns a plugin with its own cache.
 */
export function settledBlocksPlugin() {
  let settled = EMPTY;
  return function remarkSettledBlocks(this: Processor) {
    const parse = (doc: string) => fromMarkdown(doc, { ...this.data("settings"), extensions: this.data("micromarkExtensions") || [], mdastExtensions: this.data("fromMarkdownExtensions") || [] });
    this.parser = (doc: string): Root => {
      if (DEFINITION.test(doc)) { settled = EMPTY; return parse(doc); }
      if (!doc.startsWith(settled.text) || doc.length === settled.text.length) settled = EMPTY;
      const tail = parse(doc.slice(settled.text.length));
      const base = settled.start;
      for (const node of tail.children) shiftPositions(node, base);
      const children = [...settled.children, ...tail.children];
      const open = tail.children.length - 1 - (tail.children.at(-2)?.type === "list" ? 1 : 0);
      const first = tail.children[open]?.position?.start;
      if (open > 0 && first) {
        // The next parse starts at the beginning of that block's line (its indentation matters for lists).
        const start = { line: first.line, column: 1, offset: (first.offset ?? 0) - (first.column - 1) };
        settled = { text: doc.slice(0, start.offset), children: children.slice(0, settled.children.length + open), start };
      }
      const end = tail.position?.end;
      return { type: "root", children, position: { start: { line: 1, column: 1, offset: 0 }, end: end ? shiftPoint({ ...end }, base) : { line: 1, column: 1, offset: 0 } } };
    };
  };
}

// Tail positions are relative to a text that starts at column 1 of line `base.line`: columns stay, lines and offsets move.
function shiftPositions(node: Nodes, base: Point) {
  if (node.position) { shiftPoint(node.position.start, base); shiftPoint(node.position.end, base); }
  if ("children" in node) for (const child of node.children) shiftPositions(child, base);
}

function shiftPoint(point: Point, base: Point) {
  point.line += base.line - 1;
  if (point.offset !== undefined && base.offset !== undefined) point.offset += base.offset;
  return point;
}
