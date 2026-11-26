import { pageErrorMessage } from "../../../workbench/store/requests/page-error-message.js";
export async function saveTerminal(ctx, keys) {
  const { drafts, setSaving, setError, actions, setDrafts, load } = ctx;
  const draft = drafts["group:tools:package:<inline:terminals>"];
  setSaving(true); setError("");
  try {
    await actions.api.post("/capabilities", { terminal: Object.fromEntries(keys.map((key) => [key, draft[key]])) });
    setDrafts(({ "group:tools:package:<inline:terminals>": _, ...rest }) => rest);
    await load();
  } catch (cause) { setError(pageErrorMessage(cause)); }
  finally { setSaving(false); }
}
