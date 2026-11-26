import { layout } from "../../layout/layout-store.ts";
import { editorLayoutKey } from "../../../workspace/editor-layout/editor-layout-key.ts";
import { mergeSavedLayout } from "../../../workspace/editor-layout/merge-saved-layout.ts";
export function resetLayout(workspaceSessionId: string | null, workspaceMounted: boolean) {
    layout.reset();
    // The current session's split dock grid goes back to one group: a mounted workspace does that live (it watches the
    // reset, terminals and unsaved files stay); otherwise its saved grid is rewritten so it opens merged.
    if (workspaceSessionId && !workspaceMounted) {
      const key = editorLayoutKey(workspaceSessionId);
      const merged = mergeSavedLayout(window.localStorage.getItem(key) ?? "");
      if (merged) window.localStorage.setItem(key, merged);
    }
}
