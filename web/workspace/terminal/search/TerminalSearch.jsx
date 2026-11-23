import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { ActionIcon } from "@mantine/core";
import { TextInput } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { IconChevronUp } from "@tabler/icons-react";
import { IconX } from "@tabler/icons-react";
import { searchDecorations } from "./search-decorations.js";

const LIMIT = 100; // the search addon's highlightLimit (load-terminal-addons)

/** The find bar over one shell (Ctrl+Shift+F or the right-click menu): typing searches the scrollback as you go,
 * Enter / Shift+Enter step to the next / previous match, Escape closes and returns focus to the terminal.
 * `search`, `term`, `host`: refs to the shell's SearchAddon, its xterm, and the element theme colours are read from. */
export function TerminalSearch({ search, term: xterm, host, onClose }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState({ resultIndex: -1, resultCount: 0 });
  const input = useRef(null);
  useEffect(() => {
    const addon = search.current;
    input.current?.focus();
    const subscription = addon.onDidChangeResults(setResults);
    return () => { subscription.dispose(); addon.clearDecorations(); };
  }, [search]);
  const find = (value, backwards, typing = false) => {
    const addon = search.current;
    const options = { decorations: searchDecorations(host.current), incremental: typing };
    if (!value) { addon.clearDecorations(); xterm.current?.clearSelection(); setResults({ resultIndex: -1, resultCount: 0 }); return; }
    if (backwards) addon.findPrevious(value, options); else addon.findNext(value, options);
  };
  const close = () => { onClose(); xterm.current?.focus(); };
  const { resultIndex, resultCount } = results;
  const count = !term ? "" : !resultCount ? "0" : `${resultIndex < 0 ? "?" : resultIndex + 1}/${resultCount}${resultCount >= LIMIT ? "+" : ""}`;
  return <div className="pi-term-search" data-kind="terminal-search" data-count={term ? resultCount : undefined} data-index={term ? resultIndex : undefined}>
    <TextInput ref={input} size="xs" value={term} aria-label="在终端中查找" placeholder="查找" rightSection={<span className="pi-term-search-count">{count}</span>} rightSectionWidth={64}
      onChange={(event) => { const value = event.currentTarget.value; setTerm(value); find(value, false, true); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); close(); }
        else if (event.key === "Enter") { event.preventDefault(); find(term, event.shiftKey); }
      }} />
    <ActionIcon size="sm" variant="subtle" color="gray" data-action="search-previous" aria-label="上一个" disabled={!term} onClick={() => find(term, true)}><IconChevronUp size={15} /></ActionIcon>
    <ActionIcon size="sm" variant="subtle" color="gray" data-action="search-next" aria-label="下一个" disabled={!term} onClick={() => find(term, false)}><IconChevronDown size={15} /></ActionIcon>
    <ActionIcon size="sm" variant="subtle" color="gray" data-action="search-close" aria-label="关闭查找" onClick={close}><IconX size={15} /></ActionIcon>
  </div>;
}
