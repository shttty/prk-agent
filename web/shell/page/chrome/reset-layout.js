import { layout } from "../../layout/layout-store.js";
import { editorLayoutKey } from "../../../workspace/editor-layout/editor-layout-key.js";
import { mergeSavedLayout } from "../../../workspace/editor-layout/merge-saved-layout.js";
export function resetLayout(workspaceSessionId, workspaceMounted) {
    layout.reset();
    // The current session's split dock grid goes back to one group: a mounted workspace does that live (it watches the
    // reset, terminals and unsaved files stay); otherwise its saved grid is rewritten so it opens merged.
    if (workspaceSessionId && !workspaceMounted) {
      const key = editorLayoutKey(workspaceSessionId);
      const merged = mergeSavedLayout(window.localStorage.getItem(key));
      if (merged) window.localStorage.setItem(key, merged);
    }
}
