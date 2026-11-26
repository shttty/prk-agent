export const LAYOUT = {
  sessionOpen: true, // left session sidebar shown (desktop)
  sessionWidth: 280, // its width
  workspaceOpen: false, // workspace shown (desktop: the groups around the chat; phone: the full-screen overlay)
  treeOpen: false, // directory shown (desktop: floating popover, or the pinned column)
  treePinned: false, // directory pinned as a column at the stage's right edge instead of a popover (desktop)
  treeWidth: 270, // directory column width (pinned) / popover width
  lastPreset: "builtin:1", // the layout last applied ("builtin:<n>" | "saved:<name>"), every session: where new tabs land
  monitorOpenBlocks: "", // folding monitor sections left open ("children", "processes"), across sessions and reloads
  monitorCollapsed: false, // the monitor panel folded back to its button (desktop; the phone opens its sheet on demand)
};

export const layoutKey = (name: string) => `pi.layout.${name}`;

// Layout saved as whole documents beside the LAYOUT values. "重置布局" does not remove them: it re-arranges the current
// session's grid by built-in layout 1 and leaves the user's saved layouts alone. Every document key starts with
// `pi.layout.` and is read and written only by the layout store's own files.
// - `grid.<sessionId>`: the desktop stage grid of one session (dockview JSON: groups, splits, sizes, tabs; `main`, the
//   group that absorbs size changes; `preferred`, the other groups' preferred sizes).
// - `presets`: the user's saved layouts, one list for every session (names and arrangements with the groups' preferred
//   sizes, no tabs).
export const gridKey = (sessionId: string) => `pi.layout.grid.${sessionId}`;

export const PRESETS_KEY = "pi.layout.presets";
