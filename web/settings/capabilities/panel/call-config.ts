import type { CapabilityCtx, ProviderConfigView } from "../capability-types.ts";
import { pageErrorMessage } from "../../../workbench/store/requests/page-error-message.js";
export async function callConfig(ctx: Pick<CapabilityCtx, "setSaving" | "setError" | "actions" | "setConfigs">, id: string, route: string, body: object) {
  const { setSaving, setError, actions, setConfigs } = ctx;
  setSaving(true); setError("");
  try {
    const view: ProviderConfigView = await actions.api.post(`/plugin-config/${route}`, body);
    setConfigs((all) => ({ ...all, [id]: view }));
    return view;
  } catch (cause) { setError(pageErrorMessage(cause)); return null; }
  finally { setSaving(false); }
}
