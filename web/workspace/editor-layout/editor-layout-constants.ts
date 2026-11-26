
export const FILE_COMPONENT = "file";

export const DIFF_COMPONENT = "diff";

// One panel per shell (`params.name`); its React part (xterm and socket) stays mounted while the tab is hidden, split or moved.
export const TERMINAL_COMPONENT = "terminal";

// How dockview renders a shell's panel: inside its group's content container, so the terminal changes size in the same frame
// as its group. dockview's "always" overlay is repositioned one animation frame after the group is laid out, so on a shrink
// (e.g. the workspace leaving the main stage) the wider overlay painted over the neighbouring group for that frame.
export const TERMINAL_RENDERER = "onlyWhenVisible";

// The prompt viewer of the debug tools: one panel per session, no params.
export const PROMPT_COMPONENT = "prompt";
export const PROMPT_PANEL_ID = "prompt";
