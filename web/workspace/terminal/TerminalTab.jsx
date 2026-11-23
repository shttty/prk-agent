import { useContext } from "react";
import { CloseButton } from "@mantine/core";
import { IconTerminal2 } from "@tabler/icons-react";
import { TerminalContext } from "./terminal-context.js";

/** One shell's tab in the workspace dock: icon, the shell's label, close. Closing asks to end the shell (see
 * use-end-terminal); the machine is in the tooltip. */
export function TerminalTab({ name }) {
  const { place, metadata, requestEnd } = useContext(TerminalContext);
  const label = metadata[name]?.label || name;
  return <div className="pi-tab" data-kind="terminal" data-shell={name} data-owner={metadata[name]?.owner || "user"} title={place ? `${place} · ${label}` : label}>
    <IconTerminal2 size={14} aria-hidden="true" />
    <span className="pi-tab-name">{label}</span>
    <CloseButton size="xs" className="pi-tab-close" data-action="close-tab" aria-label={`结束终端 ${label}`} onPointerDown={(event) => event.preventDefault()} onClick={(event) => { event.preventDefault(); requestEnd(name); }} />
  </div>;
}
