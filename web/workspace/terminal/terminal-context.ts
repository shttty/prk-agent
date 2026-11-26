import { createContext } from "react";
import type { TerminalContextValue } from "./terminal-types.ts";

/** What a shell's tab and panel in the workspace dock need from the page:
 * `{ api, sessionId, place, enabled, listed, metadata, noteGeneration, requestEnd, quote }`. `metadata` maps shell name to the
 * server's `{ label, owner, generation }`; a tab made from it subscribes with that generation and never creates the shell.
 * `noteGeneration(name, generation)` records the generation a just-opened tab received (only a user-opened tab connects
 * without one). `listed` turns true once the server's terminal list was read (a restored tab must not attach before
 * that, or it would recreate a shell that is gone); `requestEnd(name)` asks to end a shell; `quote(text)` puts selected
 * terminal text into the session's composer (text the user chose to send; the model never reads the shell itself). */
export const TerminalContext = createContext<TerminalContextValue | null>(null);
