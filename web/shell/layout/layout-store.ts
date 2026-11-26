import { LAYOUT, layoutKey } from "./layout-constants.ts";
import { storage } from "./layout-storage.ts";
import { readSaved } from "./read-saved.ts";
import type { LayoutState, LayoutValues } from "./layout-types.ts";

const listeners = new Set<() => void>();

let state: LayoutState | null = null;

const savedValues = (): LayoutValues => ({
  sessionOpen: readSaved("sessionOpen"), sessionWidth: readSaved("sessionWidth"), workspaceOpen: readSaved("workspaceOpen"),
  treeOpen: readSaved("treeOpen"), treePinned: readSaved("treePinned"), treeWidth: readSaved("treeWidth"), lastPreset: readSaved("lastPreset"),
  monitorOpenBlocks: readSaved("monitorOpenBlocks"), monitorCollapsed: readSaved("monitorCollapsed"),
});

const current = () => (state ??= { ...savedValues(), resets: 0 });

const emit = () => { for (const listener of [...listeners]) listener(); };

export const layout = {
  get: current,
  subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  /** `patch`: `{ name: value }` for names in LAYOUT; saved at once. */
  set(patch: Partial<LayoutValues>) {
    for (const [name, value] of Object.entries(patch)) {
      if (!(name in LAYOUT)) throw new Error(`unknown layout state ${name}`);
      try { storage()?.setItem(layoutKey(name), JSON.stringify(value)); } catch { /* private mode: this tab only */ }
    }
    state = { ...current(), ...patch };
    emit();
  },
  /** Everything in LAYOUT back to its default (saved keys removed). */
  reset() {
    for (const name of Object.keys(LAYOUT)) { try { storage()?.removeItem(layoutKey(name)); } catch { /* private mode */ } }
    state = { ...LAYOUT, resets: current().resets + 1 };
    emit();
  },
};
