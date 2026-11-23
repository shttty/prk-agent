import { useState } from "react";
import { useEffect } from "react";
export function useVisible(api) {
  const [visible, setVisible] = useState(api.isVisible);
  useEffect(() => {
    setVisible(api.isVisible);
    const subscription = api.onDidVisibilityChange((event) => setVisible(event.isVisible));
    return () => subscription.dispose();
  }, [api]);
  return visible;
}
