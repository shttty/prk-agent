import type { PageApi } from "../../shell/page/page-types.ts";
import { useEffect, useState } from "react";
import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.ts";

export type MetricsSettings = { enabled: boolean; port: number };
/** `url` is where the Gateway answers now (null: not listening); `error` is why enabled metrics are not served. */
export type MetricsView = MetricsSettings & { url: string | null; error: string | null };

const PATH = "/settings/metrics";

/** The Gateway's metrics endpoint through `/api/settings/metrics`; a save applies at once, so `view` is always the running state. `save` resolves whether it was applied. */
export function useMetricsSettings(api: PageApi) {
  const [view, setView] = useState<MetricsView | null>(null);
  const [failure, setFailure] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let current = true;
    api.get<MetricsView>(PATH).then((next) => { if (current) setView(next); })
      .catch((cause: unknown) => { if (current) setFailure(pageErrorMessage(cause)); });
    return () => { current = false; };
  }, [api]);
  const save = async (change: MetricsSettings) => {
    setSaving(true);
    setFailure("");
    try { setView(await api.post<MetricsView>(PATH, change)); return true; }
    catch (cause) { setFailure(pageErrorMessage(cause) || "保存失败。"); return false; }
    finally { setSaving(false); }
  };
  return { view, failure, setFailure, saving, save };
}
