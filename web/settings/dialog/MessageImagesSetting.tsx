import type { WorkbenchState } from "../../shell/page/page-types.ts";
import { IconPhoto } from "@tabler/icons-react";
import { PrkSwitch } from "../../design-system/switch/PrkSwitch.tsx";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";

export function MessageImagesSetting({ setShowImages }: { setShowImages: (enabled: boolean) => void }) {
  const enabled = useWorkbench((state: WorkbenchState) => state.showImages);
  return <div className="pi-settings-row is-static">
    <span className="pi-settings-icon" aria-hidden="true"><IconPhoto size={16} stroke={1.7} /></span>
    <label className="pi-settings-title" htmlFor="setting-show-message-images">显示消息图片</label>
    <PrkSwitch id="setting-show-message-images" checked={enabled} onChange={(event) => setShowImages(event.currentTarget.checked)} />
  </div>;
}
