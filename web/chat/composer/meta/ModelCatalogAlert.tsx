import InlineAlert from "../../../design-system/inline-alert/InlineAlert.tsx";
import { useWorkbench } from "../../../workbench/subscription/use-workbench.ts";
/** Says why the model select is empty when the model catalog failed to load; sits under the composer. */
export function ModelCatalogAlert() {
  const error = useWorkbench((state) => state.modelCatalog?.error);
  return error ? <InlineAlert color="yellow" role="status" className="pi-model-error">模型目录不可用：{error}</InlineAlert> : null;
}
