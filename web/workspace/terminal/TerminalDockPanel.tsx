import { useTerminalContext } from "./use-terminal-context.ts";
import { TerminalView } from "./TerminalView.tsx";
import "./terminal.css";

/** Body of one shell's tab in the workspace dock. Nothing attaches until the server's terminal list was read, and where no
 * terminal can exist (closed session) it stays empty. A shell the server ended closes its tab (`onEnded`). A tab made from
 * the list subscribes with that entry's generation; a tab the user just opened has none and reports the one it gets. */
type TerminalDockPanelProps = { name: string; visible: boolean; onEnded: () => void };

export default function TerminalDockPanel({ name, visible, onEnded }: TerminalDockPanelProps) {
  const { api, sessionId, enabled, listed, metadata, noteGeneration, quote } = useTerminalContext();
  if (!enabled || !listed) return null;
  return <div className="pi-term" data-shell={name}>
    <TerminalView api={api} sessionId={sessionId} name={name} active={visible} generation={metadata[name]?.generation} onGeneration={(generation: string, cleanup?: string) => noteGeneration?.(name, generation, cleanup)} onClosed={onEnded} onQuote={quote} />
  </div>;
}
