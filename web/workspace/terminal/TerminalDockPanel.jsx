import { useContext } from "react";
import { TerminalContext } from "./terminal-context.js";
import { TerminalView } from "./TerminalView.jsx";
import "./terminal.css";

/** Body of one shell's tab in the workspace dock. Nothing attaches until the server's terminal list was read, and where no
 * terminal can exist (closed session) it stays empty. A shell the server ended closes its tab (`onEnded`). A tab made from
 * the list subscribes with that entry's generation; a tab the user just opened has none and reports the one it gets. */
export default function TerminalDockPanel({ name, visible, onEnded }) {
  const { api, sessionId, enabled, listed, metadata, noteGeneration, quote } = useContext(TerminalContext);
  if (!enabled || !listed) return null;
  return <div className="pi-term" data-shell={name}>
    <TerminalView api={api} sessionId={sessionId} name={name} active={visible} generation={metadata[name]?.generation} onGeneration={(generation, cleanup) => noteGeneration?.(name, generation, cleanup)} onClosed={onEnded} onQuote={quote} />
  </div>;
}
