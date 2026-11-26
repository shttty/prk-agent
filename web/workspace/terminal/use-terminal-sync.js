import { useEffect } from "react";
import { useEffectEvent } from "react";
import { useCallback } from "react";
import { useRef } from "react";
import { useState } from "react";
import { nextShellName } from "./next-shell-name.js";

/** Keep the dock's shell tabs in line with the server's terminal list while the workspace is shown: every shell the
 * server has gets a tab (background tabs; the first one into an empty dock is shown), a tab restored from the saved layout
 * whose shell is gone is closed once (before anything attaches to it), and a dock left empty opens a first shell (after a
 * Gateway restart every restored tab is gone, and the workspace must not come up without one). It reads the
 * list when the workspace opens and whenever `refreshKey` moves (a model tool made or touched a terminal), and retries
 * while the API is unreachable. `onShown` runs when a tab it opened became the shown one.
 * `metadata[name].generation` is the list entry's generation, which that tab subscribes with; a tab keeps the generation
 * it has while it exists, even if a later list lacks its shell (it then ends, it is never recreated).
 * `noteGeneration(name, generation)` records the generation a just-opened tab got from its first snapshot.
 * Returns `{ listed, metadata, noteGeneration }`. */
export function useTerminalSync({ engine, api, sessionId, enabled, hidden, refreshKey, onShown }) {
  const [listed, setListed] = useState(false);
  const [metadata, setMetadata] = useState({});
  const reconciliation = useRef(null);
  const shown = useEffectEvent(() => onShown?.());
  const base = `/sessions/${encodeURIComponent(sessionId)}/terminals`;
  useEffect(() => {
    if (!engine) return undefined;
    // Only saved tabs can be stale; a user can open a new one while the first list is in flight.
    if (reconciliation.current?.engine !== engine) reconciliation.current = { engine, restored: engine.terminalNames() };
    if (!enabled || hidden) return undefined;
    let live = true;
    let timer = 0;
    const load = () => api.get(base).then((result) => {
      if (!live) return;
      const terminals = result?.terminals || [];
      const names = terminals.map((item) => item.name);
      const restored = reconciliation.current.restored;
      reconciliation.current.restored = null;
      for (const name of restored ?? []) if (!names.includes(name)) engine.closeTerminal(name);
      const tabs = engine.terminalNames();
      setMetadata((previous) => {
        const next = Object.fromEntries(terminals.map((item) => [item.name, item]));
        for (const tab of tabs) if (!next[tab] && previous[tab]?.generation) next[tab] = { name: tab, generation: previous[tab].generation };
        return next;
      });
      setListed(true);
      let activated = false;
      for (const name of names) activated = engine.openTerminal(name, false) || activated;
      if (engine.count() === 0) activated = engine.openTerminal(nextShellName(names), true) || activated;
      if (activated) shown();
    }, () => { if (live) timer = window.setTimeout(load, 1500); });
    void load();
    return () => { live = false; window.clearTimeout(timer); };
  }, [engine, api, base, enabled, hidden, refreshKey]);
  const noteGeneration = useCallback((name, generation, cleanup) => setMetadata((current) => (current[name]?.generation === generation && current[name]?.cleanup === (cleanup ?? current[name]?.cleanup) ? current : { ...current, [name]: { ...current[name], name, generation, ...(cleanup ? { cleanup } : {}) } })), []);
  return { listed, metadata, noteGeneration };
}
