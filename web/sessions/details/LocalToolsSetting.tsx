import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { WorkbenchActions } from "../workbench-actions-types.ts";
import type { NativeCatalog } from "../../../src/gateway/wire/web-types.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

/** 本机工具 (local session) / 原生工具 (remote session): one switch, native action `local-tools`.
 * Permissions switch immediately and declarations apply on the next request without reloading. */
type LocalToolsSettingProps = { actions: WorkbenchActions; blocked: boolean };

export function LocalToolsSetting({ actions, blocked }: LocalToolsSettingProps) {
  const catalog: NativeCatalog | null | undefined = useWorkbench((state: WorkbenchState) => state.session.nativeCatalog?.value);
  const localTools = useWorkbench((state: WorkbenchState) => state.session.snapshot?.localTools);
  if (!catalog?.target) return null;
  const local = catalog.target.local === true;
  const action = catalog.actions?.find((item) => item.name === "local-tools");
  return <PrkSwitch
    id="chat-local-tools"
    data-local={local ? "true" : "false"}
    className="pi-local-tools"
    label={local ? "本机工具" : "原生工具"}
    description="立即切权限，下一请求生效"
    checked={localTools === true}
    disabled={blocked || !action || action.enabled === false}
    onChange={(event) => void actions.executeNativeAction("local-tools", { enabled: event.currentTarget.checked }, { transcript: false })}
  />;
}
