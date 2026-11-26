import type { CapabilityCtx, LibraryEntry } from "../capability-types.ts";
import { pageErrorMessage } from "../../../workbench/store/requests/page-error-message.js";
export async function mutateLibrary(ctx: Pick<CapabilityCtx, "generation" | "setSaving" | "setError" | "actions" | "kind" | "setDeletion" | "hidePeek" | "load">, action: string, entry: LibraryEntry) {
  const { generation, setSaving, setError, actions, kind, setDeletion, hidePeek, load } = ctx;
  const current = generation.current;
  setSaving(true); setError("");
  try {
    await actions.api.post(`/${kind}/${encodeURIComponent(entry.name)}/${action}`, {});
    if (current === generation.current) { setDeletion(null); if (action === "delete") hidePeek(); await load(); }
  } catch (cause) { if (current === generation.current) setError(pageErrorMessage(cause)); }
  finally { setSaving(false); }
}
