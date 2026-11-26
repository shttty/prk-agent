import type { CapabilityChange, CapabilityCtx } from "../capability-types.ts";
import { pageErrorMessage } from "../../../workbench/store/requests/page-error-message.js";
export async function change(ctx: Pick<CapabilityCtx, "generation" | "setSaving" | "setError" | "session" | "actions" | "instance" | "load">, idOrChanges: string | CapabilityChange[], enabled?: boolean | null) {
  const { generation, setSaving, setError, session, actions, instance, load } = ctx;
  const changes: CapabilityChange[] = Array.isArray(idOrChanges) ? idOrChanges : [{ id: idOrChanges, enabled: enabled ?? null }];
  if (!changes.length) return;
  const current = generation.current;
  setSaving(true); setError("");
  try {
    if (session) {
      if (!await actions.executeNativeAction("capabilities", { changes }, { transcript: false })) throw new Error("工具设置保存失败。");
    } else await actions.api.post("/capabilities", instance ? { instance, changes } : { changes });
    if (current === generation.current) await load();
  } catch (cause) { if (current === generation.current) setError(pageErrorMessage(cause)); }
  finally { setSaving(false); }
}
