
export const LAYOUT = {
  sessionOpen: true, // left session sidebar shown (desktop)
  sessionWidth: 280, // its width
  workspaceOpen: false, // workspace shown (desktop: the groups around the chat; phone: the full-screen overlay)
  treeOpen: false, // directory shown (desktop: floating popover, or the pinned column)
  treePinned: false, // directory pinned as a column at the stage's right edge instead of a popover (desktop)
  treeWidth: 270, // directory column width (pinned) / popover width
  lastPreset: "builtin:1", // the layout last applied ("builtin:<n>" | "saved:<name>"), every session: where new tabs land
  monitorOpenBlocks: "", // monitor sections expanded across sessions and reloads
  monitorCollapsed: false, // the monitor panel folded back to its button (desktop; the phone opens its sheet on demand)
};

export const layoutKey = (name) => `pi.layout.${name}`;

export const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function readSaved(name) {
  const fallback = LAYOUT[name];
  try {
    const value = JSON.parse(storage()?.getItem(layoutKey(name)) ?? "null");
    return typeof value === typeof fallback && (typeof value !== "number" || (Number.isFinite(value) && value > 0)) ? value : fallback;
  } catch { return fallback; }
}

export const listeners = new Set();

export let state = null;

export const current = () => (state ??= { ...Object.fromEntries(Object.keys(LAYOUT).map((name) => [name, readSaved(name)])), resets: 0 });

export const emit = () => { for (const listener of [...listeners]) listener(); };

export const layout = {
  get: current,
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  /** `patch`: `{ name: value }` for names in LAYOUT; saved at once. */
  set(patch) {
    const next = { ...current() };
    for (const [name, value] of Object.entries(patch)) {
      if (!(name in LAYOUT)) throw new Error(`unknown layout state ${name}`);
      next[name] = value;
      try { storage()?.setItem(layoutKey(name), JSON.stringify(value)); } catch { /* private mode: this tab only */ }
    }
    state = next;
    emit();
  },
  /** Everything in LAYOUT back to its default (saved keys removed). */
  reset() {
    for (const name of Object.keys(LAYOUT)) { try { storage()?.removeItem(layoutKey(name)); } catch { /* private mode */ } }
    state = { ...LAYOUT, resets: current().resets + 1 };
    emit();
  },
};

// Layout saved as whole documents beside the LAYOUT values. "重置布局" does not remove them: it re-arranges the current
// session's grid by built-in layout 1 and leaves the user's saved layouts alone. Every document key starts with
// `pi.layout.` and is read and written only here.
// - `grid.<sessionId>`: the desktop stage grid of one session (dockview JSON: groups, splits, sizes, tabs; `main`, the
//   group that absorbs size changes; `preferred`, the other groups' preferred sizes).
// - `presets`: the user's saved layouts, one list for every session (names and arrangements with the groups' preferred
//   sizes, no tabs).
export const gridKey = (sessionId) => `pi.layout.grid.${sessionId}`;

export const PRESETS_KEY = "pi.layout.presets";

const readDocument = (key) => { try { return JSON.parse(storage()?.getItem(key) ?? "null"); } catch { return null; } };

const saveDocument = (key, value) => { try { storage()?.setItem(key, JSON.stringify(value)); } catch { /* private mode: this tab only */ } };

export const readGrid = (sessionId) => readDocument(gridKey(sessionId));

export const saveGrid = (sessionId, grid) => saveDocument(gridKey(sessionId), grid);

export const readPresets = () => readDocument(PRESETS_KEY);

export const savePresets = (presets) => saveDocument(PRESETS_KEY, presets);

