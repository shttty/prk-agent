import { PrkSwitch } from "../../design-system/switch/PrkSwitch.jsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";

/** 本机工具 (local session) / 原生工具 (remote session): one switch, native action `local-tools`.
 * Permissions switch immediately and declarations apply on the next request without reloading. */
export function LocalToolsSetting({ actions, blocked }) {
  const catalog = useWorkbench((state) => state.session.nativeCatalog?.value);
  const localTools = useWorkbench((state) => state.session.snapshot?.localTools);
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
