/** A file's diff the monitor asked the workspace to open (served once). */
export type DiffRequest = { sessionId: string; path: string };

/** A shell the monitor asked the workspace to show; `generation` is the one the server listed it with. */
export type TerminalRequest = { sessionId: string; name: string; generation: string };

/** A tab with unsaved text waiting for the close decision. */
export type CloseConfirm = { id: string; path: string };
