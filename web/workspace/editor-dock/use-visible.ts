import type { DockviewPanelApi } from "dockview-react";
import { useState } from "react";
import { useEffect } from "react";
export function useVisible(api: DockviewPanelApi) {
  const [visible, setVisible] = useState(api.isVisible);
  useEffect(() => {
    setVisible(api.isVisible);
    const subscription = api.onDidVisibilityChange((event) => setVisible(event.isVisible));
    return () => subscription.dispose();
  }, [api]);
  return visible;
}
